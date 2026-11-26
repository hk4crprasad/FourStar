"""Run on a seeded demo database. The Standard room must be free for tonight."""
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright

from e2e import BASE, OUTPUT, no_overflow, open_admin

MOBILE = "9876543210"


def draft(room_id, today, name):
    return {
        "requestId": str(uuid4()), "roomTypeId": room_id,
        "stay": {"checkIn": today.isoformat(), "checkOut": (today + timedelta(days=1)).isoformat(), "guests": 2},
        "guestName": name, "email": "demo.guest@example.com", "mobile": MOBILE, "payment": "CASH",
    }


def simultaneous_booking(today, staff):
    start = today + timedelta(days=3)
    payloads = [draft("deluxe", start, f"Concurrency demo {uuid4().hex[:5]}") for _ in range(2)]

    def submit(body):
        request = Request(f"{BASE}/api/reservations", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
        try:
            with urlopen(request, timeout=15) as response:
                return response.status, json.load(response)["id"]
        except HTTPError as error:
            return error.code, None

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(submit, payloads))
    assert sorted(status for status, _ in results) == [201, 409], results
    reservation = next(booking for _, booking in results if booking)
    assert staff.request.patch(f"{BASE}/api/admin/hotel/reservations/{reservation}", data={"status": "CANCELLED"}).ok


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        staff = open_admin(browser)
        assert staff.request.get(f"{BASE}/api/admin/hotel").ok
        navigation = staff.get_by_role("navigation", name="Admin navigation")
        navigation.get_by_role("button", name="Reservations").click()
        booking = browser.new_page(viewport={"width": 1440, "height": 960})
        mobile = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=1)
        mobile.goto(BASE, wait_until="networkidle")
        no_overflow(mobile)
        expect(mobile.get_by_role("heading", name="Featured rooms")).to_be_visible()
        mobile.screenshot(path=OUTPUT / "mobile-hotel.png", animations="disabled")
        booking.goto(BASE, wait_until="networkidle")
        no_overflow(booking)
        expect(booking.get_by_role("heading", name="From the Indian kitchen")).to_be_visible()
        booking.screenshot(path=OUTPUT / "desktop-hotel.png", animations="disabled")
        booking.get_by_role("link", name="Book rooms").last.click()
        expect(booking.get_by_role("heading", name="Rooms & suites")).to_be_visible()
        today = date.fromisoformat(booking.get_by_label("Check-in", exact=True).input_value())
        booking.get_by_role("combobox", name="Guests").select_option("2")
        booking.get_by_role("button", name="Check availability").click()
        expect(booking.get_by_role("status").filter(has_text="available for 1 night.")).to_be_visible()
        booking.get_by_role("link", name="View Standard").click()
        expect(booking.get_by_role("heading", name="Standard", exact=True)).to_be_visible()
        booking.get_by_role("button", name="View room photo 2").click()
        expect(booking.get_by_role("img", name="Standard, photo 2")).to_be_visible()
        booking.get_by_role("button", name="Check availability").click()
        expect(booking.get_by_role("status").filter(has_text="Available for your stay.")).to_be_visible()
        booking.get_by_role("button", name="Continue to booking").click()
        guest = f"Hotel Demo {uuid4().hex[:7]}"
        dialog = booking.get_by_role("dialog", name="Guest details")
        dialog.get_by_label("Full name").fill(guest)
        dialog.get_by_label("Email").fill("hotel-demo@example.com")
        dialog.get_by_label("Mobile number").fill(MOBILE)
        expect(dialog.get_by_text("₹2,499", exact=True)).to_have_count(2)
        dialog.get_by_role("button", name="Request reservation").click()
        expect(booking.get_by_role("heading", name="Reservation requested")).to_be_visible(timeout=12_000)
        id = booking.locator(".track-id").inner_text()
        assert id.startswith("FSR-")
        reservation = booking.request.get(f"{BASE}/api/reservations/{id}").json()
        assert "guest" not in reservation and "email" not in reservation and reservation["total"] == 249900

        competing = booking.request.post(f"{BASE}/api/reservations", data=draft("standard", today, "Overlapping reservation"))
        assert competing.status == 409, competing.text()
        adjacent = booking.request.post(f"{BASE}/api/reservations", data=draft("standard", today + timedelta(days=1), "Adjacent reservation"))
        assert adjacent.status == 201, adjacent.text()
        assert staff.request.patch(f"{BASE}/api/admin/hotel/reservations/{adjacent.json()['id']}", data={"status": "CANCELLED"}).ok
        simultaneous_booking(today, staff)

        restricted = {"requestId": str(uuid4()), "type": "ROOM_SERVICE", "payment": "CASH",
                      "items": [{"menuItemId": "garlic-naan", "quantity": 1, "picks": []}]}
        assert booking.request.post(f"{BASE}/api/orders", data=restricted).status == 403
        verify_data = {"reservationId": id, "mobile": MOBILE}
        assert booking.request.post(f"{BASE}/api/room-service", data=verify_data).status == 403

        staff.bring_to_front()
        staff.get_by_role("button").filter(has_text=guest).click()
        card = staff.get_by_role("dialog", name=f"Reservation for {guest}")
        expect(card.get_by_text("101 · Standard")).to_be_visible()
        card.get_by_role("button", name="Confirm reservation").click()
        expect(card.get_by_role("button", name="Check in guest")).to_be_visible()
        card.get_by_role("button", name="Check in guest").click()
        expect(card.get_by_role("button", name="Check out guest")).to_be_visible()
        card.get_by_role("button", name="Close dialog").click()

        navigation.get_by_role("button", name="Availability calendar").click()
        expect(staff.get_by_role("cell", name="Checked in", exact=True)).to_be_visible()
        navigation.get_by_role("button", name="Room inventory").click()
        expect(staff.get_by_text("1 / 4", exact=False)).to_be_visible()
        staff.get_by_role("button", name="Room service QR for 101").click()
        qr_link = staff.get_by_role("link", name="Download QR code").get_attribute("href")
        qr = staff.request.get(f"{BASE}{qr_link}")
        assert qr.ok and qr.body().startswith(b"\x89PNG")
        assert booking.request.get(f"{BASE}{qr_link}").status == 401
        staff.get_by_role("button", name="Close dialog").click()

        response = booking.request.post(f"{BASE}/api/room-service", data={**verify_data, "roomToken": str(uuid4())})
        assert response.status == 403
        booking.bring_to_front()
        expect(booking.get_by_role("link", name="Order room service")).to_be_visible(timeout=12_000)
        room_service = booking.get_by_role("link", name="Order room service").get_attribute("href")
        mobile.goto(f"{BASE}{room_service}", wait_until="networkidle")
        mobile.get_by_label("Booking mobile number").fill(MOBILE)
        mobile.get_by_role("button", name="Verify check-in").click()
        expect(mobile.get_by_text("Room service · Room 101")).to_be_visible(timeout=12_000)
        mobile.get_by_role("region", name="Popular Dishes").get_by_role("button", name="Add Garlic Naan").click()
        mobile.get_by_role("button").filter(has_text="View cart").click()
        mobile.get_by_role("dialog", name="Your Cart").get_by_role("button", name="Checkout").click()
        checkout = mobile.get_by_role("dialog", name="Checkout")
        expect(checkout.get_by_text("Deliver to room 101")).to_be_visible()
        checkout.get_by_role("button", name="Place order", exact=False).click()
        expect(mobile.get_by_role("heading", name="Thanks for your order.")).to_be_visible(timeout=12_000)
        order_id = mobile.locator(".track-id").inner_text()
        assert mobile.request.get(f"{BASE}/api/orders/{order_id}").json()["type"] == "ROOM_SERVICE"

        staff.bring_to_front()
        navigation.get_by_role("button", name="Live orders").click()
        row = staff.get_by_role("button").filter(has_text=guest).filter(has_text="Room 101")
        expect(row).to_be_visible(timeout=14_000)
        row.click()
        order = staff.get_by_role("dialog", name=f"Order for {guest}")
        expect(order.get_by_text("101", exact=True)).to_be_visible()
        for action, status in [("Accept order", "Order accepted"), ("Start preparing", "Preparing"),
                               ("Mark ready", "Ready"), ("Complete order", "Completed")]:
            staff.bring_to_front()
            order.get_by_role("button", name=action, exact=True).click()
            mobile.bring_to_front()
            expect(mobile.get_by_role("list", name="Order progress").locator("[aria-current=step]")).to_contain_text(status, timeout=12_000)

        staff.bring_to_front()
        navigation.get_by_role("button", name="Reservations").click()
        staff.get_by_role("button").filter(has_text=guest).click()
        card.get_by_role("button", name="Check out guest").click()
        expect(card.get_by_text("Checked out", exact=True).first).to_be_visible()
        card.get_by_role("button", name="Close dialog").click()
        assert mobile.request.post(f"{BASE}/api/orders", data=restricted).status == 403
        navigation.get_by_role("button", name="Room inventory").click()
        room = staff.locator(".hotel-inventory-list li").filter(has_text="Room 101")
        expect(room.get_by_text("Needs cleaning")).to_be_visible()
        room.get_by_role("button", name="Edit room 101").click()
        editor = staff.get_by_role("dialog", name="Edit room 101")
        editor.get_by_label("Housekeeping", exact=True).select_option("CLEAN")
        editor.get_by_role("button", name="Save changes").click()
        expect(room.get_by_text("Clean", exact=True)).to_be_visible()
        navigation.get_by_role("button", name="Daily reports").click()
        expect(staff.get_by_text("Combined revenue", exact=True)).to_be_visible(timeout=12_000)
        report = staff.request.get(f"{BASE}/api/admin/hotel").json()
        assert report["roomSales"] >= 249900 and report["occupied"] == 0
        browser.close()
    print("Passed hotel discovery, date search, booking, concurrent overlap protection, staff check-in, room QR, room-service fulfilment and checkout.")


if __name__ == "__main__":
    main()
