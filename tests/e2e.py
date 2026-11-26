"""Run against a seeded demo database and a running Phirmy instance."""
import os
import re
from pathlib import Path
from uuid import uuid4

from playwright.sync_api import sync_playwright, expect

BASE = os.getenv("PHIRMY_BASE_URL", "http://localhost:3000")
EMAIL = os.getenv("ADMIN_EMAIL", "admin@fourstar.test")
PASSWORD = os.getenv("ADMIN_PASSWORD", "DemoKitchen2026!")
OUTPUT = Path(os.getenv("PHIRMY_SCREENSHOTS", "/tmp/phirmy-tests"))


def open_admin(browser):
    page = browser.new_page(viewport={"width": 1440, "height": 960})
    response = page.request.get(f"{BASE}/api/admin/overview")
    assert response.status == 401
    page.goto(f"{BASE}/admin", wait_until="networkidle")
    expect(page).to_have_url(re.compile(r"/admin/login$"))
    page.get_by_role("textbox", name="Email").fill(EMAIL)
    page.get_by_label(re.compile(r"^Password")).fill(PASSWORD)
    page.get_by_role("button", name="Sign in").click()
    expect(page.get_by_role("heading", name="Overview")).to_be_visible()
    page.get_by_role("navigation", name="Admin navigation").get_by_role("button", name="Live orders").click()
    return page


def no_overflow(page):
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")


def checkout(page, name, mode, address=None):
    page.get_by_role("button", name="Checkout", exact=True).last.click()
    dialog = page.get_by_role("dialog", name="Checkout")
    dialog.get_by_role("button", name=mode, exact=True).click()
    dialog.get_by_label("Full name").fill(name)
    dialog.get_by_label("Mobile number").fill("9876543210")
    if mode == "Delivery":
        dialog.get_by_label("Delivery address").fill(address or "12 Demo Road, Kataka")
    if mode == "Dine-in":
        dialog.get_by_label("Table number").fill("14")
    dialog.get_by_label("Cooking instructions").fill("Mild spice please")
    dialog.get_by_role("button", name=re.compile(r"Place order")).click()
    expect(page.get_by_role("heading", name="Thanks for your order.")).to_be_visible(timeout=15_000)
    return page.locator(".track-id").text_content()


def order_lifecycle(browser, staff, errors):
    customer = browser.new_page(viewport={"width": 1440, "height": 960})
    customer.on("pageerror", lambda error: errors.append(str(error)))
    customer.goto(f"{BASE}/food", wait_until="networkidle")
    expect(customer.get_by_role("heading", name="Popular Dishes")).to_be_visible()
    no_overflow(customer)
    customer.screenshot(animations="disabled", path=OUTPUT / "desktop-store.png")
    search = customer.get_by_role("searchbox", name="Search dishes")
    search.fill("lassi")
    search.press("Enter")
    expect(customer.get_by_role("heading", name="Search results")).to_be_visible()
    expect(customer.get_by_role("heading", name="Mango Lassi")).to_be_visible()
    search.fill("")
    customer.get_by_role("button", name="Breads", exact=True).click()
    expect(customer.get_by_role("heading", name="Breads")).to_be_visible()
    customer.get_by_role("button", name="All Items", exact=True).click()
    popular = customer.get_by_role("region", name="Popular Dishes")
    popular.get_by_role("button", name="Add Butter Chicken").click()
    item_dialog = customer.get_by_role("dialog", name="Butter Chicken")
    item_dialog.get_by_role("checkbox", name="Extra gravy").check()
    item_dialog.get_by_role("button", name=re.compile("Add to cart")).click()
    cart = customer.get_by_role("complementary", name="Your cart")
    expect(cart.get_by_text("Extra gravy")).to_be_visible()
    cart.get_by_role("button", name="Increase Butter Chicken quantity").click()
    popular.get_by_role("button", name="Add Garlic Naan").click()
    expect(cart.get_by_text("₹1,041.25")).to_be_visible()
    cart.get_by_role("button", name="Remove Garlic Naan").click()
    customer.reload(wait_until="networkidle")
    expect(cart.get_by_text("Extra gravy")).to_be_visible()
    customer.get_by_role("region", name="Popular Dishes").get_by_role("button", name="Add Garlic Naan").click()

    name = f"Demo Delivery {uuid4().hex[:6]}"
    order_id = checkout(customer, name, "Delivery")
    expect(customer.get_by_text("₹1,041.25")).to_be_visible()
    response = customer.request.get(f"{BASE}/api/orders/{order_id}")
    assert response.status == 200
    public = response.json()
    assert public["total"] == 104125
    assert all(key not in public for key in ("customer", "customerName", "address"))

    staff_row = staff.get_by_role("button").filter(has_text=name)
    staff.bring_to_front()
    expect(staff_row).to_be_visible(timeout=12_000)
    staff.screenshot(animations="disabled", path=OUTPUT / "desktop-admin.png")
    staff_row.click()
    detail = staff.get_by_role("dialog", name=f"Order for {name}")
    expect(detail.get_by_text("12 Demo Road, Kataka")).to_be_visible()
    expect(detail.get_by_text("Mild spice please")).to_be_visible()
    for action, status in [
        ("Accept order", "Order accepted"), ("Start preparing", "Preparing"),
        ("Mark ready", "Ready"), ("Mark out for delivery", "Out for delivery"),
        ("Complete order", "Completed"),
    ]:
        staff.bring_to_front()
        detail.get_by_role("button", name=action, exact=True).click()
        customer.bring_to_front()
        active = customer.get_by_role("list", name="Order progress").locator("[aria-current=step]")
        expect(active).to_contain_text(status, timeout=12_000)
    staff.get_by_role("button", name="Order history").click()
    expect(staff.get_by_role("button").filter(has_text=name)).to_be_visible(timeout=10_000)
    staff.get_by_role("button", name="Daily reports").click()
    expect(staff.get_by_text("Sales", exact=True)).to_be_visible()
    expect(staff.get_by_label("Report date")).to_have_value(re.compile(r"\d{4}-\d{2}-\d{2}"))
    customer.close()


def mobile_order(browser, staff, errors):
    page = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=1)
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(f"{BASE}/food", wait_until="networkidle")
    no_overflow(page)
    expect(page.get_by_role("navigation", name="Mobile navigation")).to_be_visible()
    page.screenshot(animations="disabled", path=OUTPUT / "mobile-store.png")
    page.get_by_role("button", name="Search menu").click()
    search = page.get_by_role("searchbox", name="Search dishes")
    search.fill("garlic naan")
    search.press("Enter")
    page.get_by_role("button", name="Add Garlic Naan").click()
    bar = page.get_by_role("button", name=re.compile("View cart"))
    expect(bar).to_be_visible()
    bar.click()
    expect(page.get_by_role("dialog", name="Your Cart")).to_be_visible()
    page.screenshot(animations="disabled", path=OUTPUT / "mobile-cart.png")
    name = f"Demo Table {uuid4().hex[:6]}"
    checkout(page, name, "Dine-in")
    expect(page.get_by_text("Out for delivery", exact=True)).to_have_count(0)
    staff.get_by_role("navigation", name="Admin navigation").get_by_role("button", name=re.compile("Live orders")).click()
    row = staff.get_by_role("button").filter(has_text=name)
    staff.bring_to_front()
    expect(row).to_be_visible(timeout=12_000)
    row.click()
    detail = staff.get_by_role("dialog", name=f"Order for {name}")
    expect(detail.get_by_text("14", exact=True)).to_be_visible()
    detail.get_by_role("button", name="Reject order").click()
    page.bring_to_front()
    expect(page.get_by_role("list", name="Order progress").locator("[aria-current=step]")).to_contain_text("Order rejected", timeout=12_000)
    page.close()


def manage_catalog(staff):
    suffix = uuid4().hex[:6]
    category = f"Demo category {suffix}"
    dish = f"Demo dish {suffix}"
    staff.get_by_role("button", name="Categories", exact=True).click()
    staff.get_by_role("button", name="Add category").click()
    dialog = staff.get_by_role("dialog", name="Add category")
    dialog.get_by_label("Name", exact=True).fill(category)
    dialog.get_by_role("button", name="Save category").click()
    expect(staff.get_by_text(category, exact=True)).to_be_visible()
    staff.get_by_role("button", name="Menu items", exact=True).click()
    staff.get_by_role("button", name="Add dish").click()
    dialog = staff.get_by_role("dialog", name="Add dish")
    dialog.get_by_label("Name", exact=True).fill(dish)
    dialog.get_by_label("Description", exact=True).fill("A test menu item for the demo.")
    dialog.locator("select[name=categoryId]").select_option(label=category)
    dialog.get_by_label("Price (₹)", exact=True).fill("125.50")
    dialog.get_by_label("Upload image", exact=True).set_input_files("public/food/garlic-naan.webp")
    expect(dialog.get_by_label("Image", exact=True)).to_have_value(re.compile(r"^/api/media/"))
    image_url = dialog.get_by_label("Image", exact=True).input_value()
    assert staff.request.get(f"{BASE}{image_url}").headers["content-type"] == "image/webp"
    dialog.get_by_role("button", name="Save dish").click()
    expect(staff.get_by_text(dish, exact=True)).to_be_visible()
    staff.get_by_role("button", name=re.compile(f"{dish} is in stock")).click()
    expect(staff.get_by_role("button", name=re.compile(f"{dish} is sold out"))).to_be_visible()
    staff.get_by_role("button", name=f"Edit {dish}").click()
    edit = staff.get_by_role("dialog", name="Edit dish")
    edit.get_by_label("Price (₹)", exact=True).fill("130")
    edit.get_by_role("button", name="Save dish").click()
    expect(staff.get_by_text(re.compile("₹130"))).to_be_visible()
    staff.get_by_role("button", name=f"Delete {dish}").click()
    staff.get_by_role("dialog", name=f"Delete {dish}?").get_by_role("button", name="Delete", exact=True).click()
    expect(staff.get_by_text(dish, exact=True)).to_have_count(0)
    staff.get_by_role("button", name="Categories", exact=True).click()
    staff.get_by_role("button", name=f"Delete {category}").click()
    staff.get_by_role("dialog", name=f"Delete {category}?").get_by_role("button", name="Delete", exact=True).click()
    expect(staff.get_by_text(category, exact=True)).to_have_count(0)
    staff.get_by_role("button", name="Restaurant settings", exact=True).click()
    staff.get_by_role("button", name="Edit settings", exact=True).click()
    expect(staff.get_by_label("Logo image", exact=True)).to_be_visible()
    staff.get_by_role("button", name="Close dialog").click()
    staff.get_by_role("button", name="Close kitchen", exact=True).click()
    expect(staff.get_by_role("button", name="Open kitchen", exact=True)).to_be_visible()
    menu = staff.request.get(f"{BASE}/api/menu").json()
    assert menu["acceptingOrders"] is False
    try:
        invalid = staff.request.post(f"{BASE}/api/orders", data={
            "requestId": str(uuid4()), "customerName": "Closed Kitchen Test", "mobile": "9876543210",
            "type": "TAKEAWAY", "payment": "CASH", "items": [{"menuItemId": "garlic-naan", "quantity": 1, "picks": []}],
        })
        assert invalid.status == 409
    finally:
        staff.get_by_role("button", name="Open kitchen", exact=True).click()
        expect(staff.get_by_role("button", name="Close kitchen", exact=True)).to_be_visible()


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        errors = []
        staff = open_admin(browser)
        staff.on("pageerror", lambda error: errors.append(str(error)))
        order_lifecycle(browser, staff, errors)
        mobile_order(browser, staff, errors)
        manage_catalog(staff)
        staff.get_by_role("button", name="Sign out").click()
        expect(staff.get_by_role("heading", name="Staff sign in")).to_be_visible()
        assert staff.request.get(f"{BASE}/api/admin/overview").status == 401
        assert not errors, errors
        browser.close()
    print("Passed desktop and mobile ordering, live updates, status transitions, reporting, admin access and menu management.")


if __name__ == "__main__":
    main()
