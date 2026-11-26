"""Exercise Smart Table against an isolated, seeded FourStar database."""
import re
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright

from e2e import BASE, OUTPUT, no_overflow, open_admin


def post(page, path, data, status=200):
    response = page.request.post(f"{BASE}{path}", data=data)
    assert response.status == status, (path, response.status, response.text())
    return response.json()


def test_table(browser):
    staff = open_admin(browser)
    staff.on("dialog", lambda dialog: dialog.accept())
    staff.goto(f"{BASE}/admin/tables")
    expect(staff.get_by_role("heading", name="Table management")).to_be_visible()
    no_overflow(staff)
    number = f"T3-{uuid4().hex[:5].upper()}"
    staff.get_by_role("button", name="Create table").click()
    edit = staff.get_by_role("dialog", name="Create table")
    edit.get_by_label("Table number").fill(number)
    edit.get_by_label("Table name").fill("Courtyard test")
    edit.get_by_role("button", name="Save table").click()
    tile = staff.get_by_role("button", name=re.compile(f"^Table {number}"))
    expect(tile).to_contain_text("Available")
    tile.click()
    details = staff.get_by_role("dialog", name=f"Table {number}")
    scan = details.get_by_role("link", name="Open scan link")
    token = scan.get_attribute("href").split("/")[-1]
    with staff.expect_download() as result:
        details.get_by_role("link", name="Download PNG").click()
    png = result.value
    assert png.suggested_filename == f"table-{number}.png"
    png.save_as(OUTPUT / "table-qr.png")
    svg = staff.request.get(f"{BASE}{details.get_by_role('link', name='Download SVG').get_attribute('href')}")
    assert svg.ok and svg.headers["content-type"] == "image/svg+xml" and "<svg" in svg.text()
    batch = staff.request.get(f"{BASE}/api/admin/tables/qr?format=cards&download")
    assert batch.ok and "Scan to Order" in batch.text() and "Table T6" in batch.text()
    staff.screenshot(path=OUTPUT / "desktop-table.png", animations="disabled")

    def current():
        response = staff.request.get(f"{BASE}/api/admin/tables")
        assert response.ok, response.text()
        return next(table for table in response.json() if table["number"] == number)

    table = current()
    details.get_by_role("button", name="Open session").click()
    code = details.get_by_test_id("visit-code").inner_text()
    session_id = current()["session"]["id"]
    guest = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    assert guest.request.get(f"{BASE}/api/admin/tables").status == 401
    post(guest, "/api/admin/tables", {"action": "open", "id": table["id"]}, 401)
    post(guest, "/api/table", {"action": "join", "token": "x" * 43, "code": code}, 404)
    post(guest, "/api/table", {"action": "join", "token": token, "code": "xxxxxxxx"}, 403)
    guest.goto(f"{BASE}/table/{token}")
    expect(guest.get_by_text(f"Table {number}", exact=True)).to_be_visible()
    guest.get_by_label("Visit code").fill(code)
    guest.get_by_role("button", name="Join table").click()
    expect(guest.get_by_role("heading", name="Popular Dishes")).to_be_visible()
    expect(guest.get_by_text(re.compile(f"You are dining at Table {number}"))).to_be_visible()
    no_overflow(guest)
    guest.screenshot(path=OUTPUT / "mobile-table.png", animations="disabled")

    kitchen = browser.new_page(storage_state=staff.context.storage_state())
    kitchen.goto(f"{BASE}/admin/kitchen")
    expect(kitchen.get_by_role("heading", name="Kitchen display")).to_be_visible()
    no_overflow(kitchen)
    popular = guest.get_by_role("region", name="Popular Dishes")
    popular.get_by_role("button", name="Add Garlic Naan").click()
    popular.get_by_role("button", name="Add Paneer Tikka").click()
    guest.get_by_role("dialog", name="Paneer Tikka").get_by_role("button", name=re.compile("Add to cart")).click()
    guest.get_by_role("button", name=re.compile("View cart")).click()
    guest.get_by_role("dialog", name="Your Cart").get_by_role("button", name="Checkout", exact=True).click()
    checkout = guest.get_by_role("dialog", name="Checkout")
    expect(checkout.get_by_label("Table number")).to_have_count(0)
    checkout.get_by_label("Cooking instructions").fill("Mild spice please")
    with guest.expect_request(lambda request: request.method == "POST" and request.url.endswith("/api/table")) as submitted:
        checkout.get_by_role("button", name=re.compile("Place order")).click()
    payload = submitted.value.post_data_json
    expect(guest.get_by_role("heading", name=f"Table {number} orders")).to_be_visible()
    order_id = guest.get_by_role("heading", name=re.compile(r"^FS-")).inner_text()
    assert post(guest, "/api/table", payload)["id"] == order_id
    assert guest.request.get(f"{BASE}/api/orders/{order_id}").status == 404
    bad_item = {"action": "order", "order": {"requestId": str(uuid4()), "items": [{"menuItemId": "kulfi", "quantity": 1, "picks": []}]}}
    post(guest, "/api/table", bad_item, 409)
    post(guest, "/api/orders", {"requestId": str(uuid4()), "customerName": "Test", "mobile": "9876543210", "type": "DINE_IN",
         "tableNumber": number, "payment": "CASH", "items": [{"menuItemId": "garlic-naan", "quantity": 1, "picks": []}]}, 400)

    def serve(reference):
        card = kitchen.locator("article").filter(has_text=reference)
        expect(card).to_be_visible(timeout=12_000)
        for action, status in (("Accept order", "Accepted"), ("Start preparing", "Preparing"),
                               ("Mark ready", "Ready to serve"), ("Mark served", "Served")):
            card.get_by_role("button", name=action).click()
            expect(guest.locator("article").filter(has_text=reference).get_by_role("status")).to_contain_text(status, timeout=12_000)

    expect(kitchen.get_by_text(re.compile("Mild spice please"))).to_be_visible(timeout=12_000)
    kitchen.screenshot(path=OUTPUT / "desktop-kitchen.png", animations="disabled")
    serve(order_id)
    extra_order = {"action": "order", "order": {"requestId": str(uuid4()), "items": [{"menuItemId": "mango-lassi", "quantity": 1, "picks": []}]}}
    second_id = post(guest, "/api/table", extra_order)["id"]
    assert second_id != order_id
    serve(second_id)
    guest.get_by_role("button", name="Request bill").click()
    post(guest, "/api/table", {"action": "request", "type": "BILL"})
    expect(details.get_by_text("Request bill", exact=True)).to_have_count(1, timeout=12_000)
    details.get_by_role("button", name="Acknowledge").click()
    expect(guest.get_by_text(re.compile("Staff acknowledged"))).to_be_visible(timeout=12_000)
    details.get_by_role("button", name="Resolve").click()
    details.get_by_role("button", name="Generate bill").click()
    expect(details.get_by_role("button", name="Record cash (demo)")).to_be_visible()
    bill = current()["session"]["bill"]
    assert bill["subtotal"] == 52700 and bill["tax"] == 2635 and bill["total"] == 55335, bill
    post(guest, "/api/table", {**extra_order, "order": {**extra_order["order"], "requestId": str(uuid4())}}, 409)
    post(staff, "/api/admin/tables", {"action": "close", "id": session_id}, 409)
    details.get_by_role("button", name="Record cash (demo)").click()
    expect(details.get_by_text(re.compile("CASH recorded"))).to_be_visible()
    details.get_by_role("button", name="Close session").click()
    expect(details.get_by_role("button", name="Open session")).to_be_visible()
    details.get_by_role("button", name="Close dialog").click()
    expect(tile).to_contain_text("Available")
    assert guest.request.get(f"{BASE}/api/table").status == 403
    post(guest, "/api/table", extra_order, 403)

    new_code = post(staff, "/api/admin/tables", {"action": "open", "id": table["id"]})["code"]
    assert new_code != code
    newcomer = browser.new_page()
    post(newcomer, "/api/table", {"action": "join", "token": token, "code": code}, 403)
    post(newcomer, "/api/table", {"action": "join", "token": token, "code": new_code})
    assert newcomer.request.get(f"{BASE}/api/table").json()["orders"] == []
    assert guest.request.get(f"{BASE}/api/table").status == 403
    post(staff, "/api/admin/tables", {"action": "close", "id": current()["session"]["id"]})
    post(staff, "/api/admin/tables", {"action": "rotate", "id": table["id"]})
    assert current()["token"] != token
    post(newcomer, "/api/table", {"action": "join", "token": token, "code": new_code}, 404)
    active_token = current()["token"]
    post(staff, "/api/admin/tables", {"action": "save", "id": table["id"], "number": number,
                                     "name": "Courtyard test", "capacity": 4, "enabled": False})
    post(newcomer, "/api/table", {"action": "join", "token": active_token, "code": new_code}, 404)
    post(staff, "/api/admin/tables", {"action": "open", "id": table["id"]}, 409)


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        test_table(browser)
        browser.close()
    print("Smart Table browser workflow and API safeguards passed.")
