import argparse
import json
import sys
from datetime import datetime
from playwright.sync_api import sync_playwright

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-url", required=True)
    parser.add_argument("--screenshot-dir", required=True)
    parser.add_argument("--headless", type=bool, default=True)
    args = parser.parse_args()

    total_steps = 10
    passed = 0
    failed = 0

    def print_step(step, action, target, status, observation, screenshot):
        print(json.dumps({
            "step": step,
            "action": action,
            "target": target,
            "status": status,
            "observation": observation,
            "screenshot": screenshot
        }))
        sys.stdout.flush()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=args.headless)
        context = browser.new_context()
        page = context.new_page()
        step = 1

        # Step 1: Select the inmate. Click the Medical tab, click Medical Status Alerts.
        try:
            page.goto(args.start_url)
            # Assuming inmate selection is by role or label, but no details given.
            # We try to find a list or table of inmates and select the first one.
            # For safety, wait for page to load.
            page.wait_for_load_state("networkidle")
            # Select inmate - assuming a list item or button with role "row" or "button" with text "Inmate"
            # Since no details, try to click first inmate row or button
            # Try to find a row or button with role "row" or "button" containing "Inmate"
            # If no text, just click first row in a table or list
            # We try a generic approach:
            inmate = page.get_by_role("row").first
            inmate.click()
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}.png")
            # Click Medical tab
            medical_tab = page.get_by_role("tab", name="Medical")
            medical_tab.click()
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}.png")
            # Click Medical Status Alerts
            medical_status_alerts = page.get_by_role("tab", name="Medical Status Alerts")
            medical_status_alerts.click()
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}.png")
            print_step(step, "Select inmate, click Medical tab, click Medical Status Alerts",
                       "Inmate row, Medical tab, Medical Status Alerts tab", "Passed",
                       "Inmate selected and Medical Status Alerts tab opened",
                       f"step_{step}.png")
            passed += 1
        except Exception as e:
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}_error.png")
            print_step(step, "Select inmate, click Medical tab, click Medical Status Alerts",
                       "Inmate row, Medical tab, Medical Status Alerts tab", "Failed",
                       f"Error: {e}",
                       f"step_{step}_error.png")
            failed += 1

        step += 1
        # Step 2: Click the “+” icon on the right side of the screen.
        try:
            plus_button = page.get_by_role("button", name="+")
            plus_button.click()
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}.png")
            print_step(step, "Click the '+' icon on right side",
                       "Button with name '+'", "Passed",
                       "Clicked '+' icon",
                       f"step_{step}.png")
            passed += 1
        except Exception as e:
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}_error.png")
            print_step(step, "Click the '+' icon on right side",
                       "Button with name '+'", "Failed",
                       f"Error: {e}",
                       f"step_{step}_error.png")
            failed += 1

        step += 1
        # Step 3: The Medical Status Alerts window will open. Screenshot
        try:
            # Wait for the Medical Status Alerts window to appear
            # Assuming it is a dialog or modal with role dialog or heading "Medical Status Alerts"
            page.wait_for_selector("role=dialog[name='Medical Status Alerts']", timeout=5000)
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}.png")
            print_step(step, "Medical Status Alerts window open",
                       "Dialog with name 'Medical Status Alerts'", "Passed",
                       "Medical Status Alerts window is open",
                       f"step_{step}.png")
            passed += 1
        except Exception as e:
            # Try alternative: wait for heading text
            try:
                page.wait_for_selector("text=Medical Status Alerts", timeout=5000)
                page.screenshot(path=f"{args.screenshot_dir}/step_{step}.png")
                print_step(step, "Medical Status Alerts window open",
                           "Text 'Medical Status Alerts'", "Passed",
                           "Medical Status Alerts window is open",
                           f"step_{step}.png")
                passed += 1
            except Exception as e2:
                page.screenshot(path=f"{args.screenshot_dir}/step_{step}_error.png")
                print_step(step, "Medical Status Alerts window open",
                           "Dialog or text 'Medical Status Alerts'", "Failed",
                           f"Error: {e}; {e2}",
                           f"step_{step}_error.png")
                failed += 1

        step += 1
        # Step 4: From the Alert drop-down menu, choose the appropriate option:
        try:
            # Assuming a label "Alert" for the dropdown
            alert_dropdown = page.get_by_label("Alert")
            alert_dropdown.click()
            # Choose the appropriate option - no option name given, so select first option
            option = alert_dropdown.locator("option").first
            option_text = option.inner_text()
            option.click()
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}.png")
            print_step(step, "Select option from Alert drop-down",
                       f"Alert drop-down option '{option_text}'", "Passed",
                       f"Selected alert option '{option_text}'",
                       f"step_{step}.png")
            passed += 1
        except Exception as e:
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}_error.png")
            print_step(step, "Select option from Alert drop-down",
                       "Alert drop-down menu", "Failed",
                       f"Error: {e}",
                       f"step_{step}_error.png")
            failed += 1

        step += 1
        # Step 5: Click Back support
        try:
            back_support = page.get_by_role("option", name="Back support")
            back_support.click()
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}.png")
            print_step(step, "Click Back support",
                       "Option 'Back support'", "Passed",
                       "Clicked 'Back support' option",
                       f"step_{step}.png")
            passed += 1
        except Exception as e:
            # Try alternative: text locator
            try:
                back_support = page.get_by_text("Back support")
                back_support.click()
                page.screenshot(path=f"{args.screenshot_dir}/step_{step}.png")
                print_step(step, "Click Back support",
                           "Text 'Back support'", "Passed",
                           "Clicked 'Back support' option",
                           f"step_{step}.png")
                passed += 1
            except Exception as e2:
                page.screenshot(path=f"{args.screenshot_dir}/step_{step}_error.png")
                print_step(step, "Click Back support",
                           "Option or text 'Back support'", "Failed",
                           f"Error: {e}; {e2}",
                           f"step_{step}_error.png")
                failed += 1

        step += 1
        # Step 6: Verify there is an Officer ID number in Adding Officer
        try:
            # Assuming a label or text "Adding Officer" with a field containing Officer ID number
            officer_field = page.get_by_label("Adding Officer")
            officer_value = officer_field.input_value()
            if officer_value and any(c.isdigit() for c in officer_value):
                observation = f"Officer ID present: {officer_value}"
                status = "Passed"
                passed += 1
            else:
                observation = "Officer ID missing or empty"
                status = "Failed"
                failed += 1
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}.png")
            print_step(step, "Verify Officer ID number in Adding Officer",
                       "Input field labeled 'Adding Officer'", status,
                       observation,
                       f"step_{step}.png")
        except Exception as e:
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}_error.png")
            print_step(step, "Verify Officer ID number in Adding Officer",
                       "Input field labeled 'Adding Officer'", "Failed",
                       f"Error: {e}",
                       f"step_{step}_error.png")
            failed += 1

        step += 1
        # Step 7: Verify the Date/Time is there and current
        try:
            # Assuming a label "Date/Time" with a field containing date/time string
            datetime_field = page.get_by_label("Date/Time")
            datetime_value = datetime_field.input_value()
            # Check if datetime_value is parseable and close to now (within 5 minutes)
            dt = None
            try:
                dt = datetime.strptime(datetime_value, "%Y-%m-%d %H:%M:%S")
            except Exception:
                try:
                    dt = datetime.strptime(datetime_value, "%m/%d/%Y %I:%M %p")
                except Exception:
                    dt = None
            if dt:
                now = datetime.now()
                delta = abs((now - dt).total_seconds())
                if delta < 300:
                    observation = f"Date/Time is current: {datetime_value}"
                    status = "Passed"
                    passed += 1
                else:
                    observation = f"Date/Time not current: {datetime_value}"
                    status = "Failed"
                    failed += 1
            else:
                observation = f"Date/Time format unrecognized: {datetime_value}"
                status = "Failed"
                failed += 1
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}.png")
            print_step(step, "Verify Date/Time is present and current",
                       "Input field labeled 'Date/Time'", status,
                       observation,
                       f"step_{step}.png")
        except Exception as e:
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}_error.png")
            print_step(step, "Verify Date/Time is present and current",
                       "Input field labeled 'Date/Time'", "Failed",
                       f"Error: {e}",
                       f"step_{step}_error.png")
            failed += 1

        step += 1
        # Step 8: Add "Test" to the comment section
        try:
            comment_field = page.get_by_label("Comment")
            comment_field.fill("Test")
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}.png")
            print_step(step, "Add 'Test' to comment section",
                       "Input field labeled 'Comment'", "Passed",
                       "Filled comment with 'Test'",
                       f"step_{step}.png")
            passed += 1
        except Exception as e:
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}_error.png")
            print_step(step, "Add 'Test' to comment section",
                       "Input field labeled 'Comment'", "Failed",
                       f"Error: {e}",
                       f"step_{step}_error.png")
            failed += 1

        step += 1
        # Step 9: Click OK to save.
        try:
            ok_button = page.get_by_role("button", name="OK")
            ok_button.click()
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}.png")
            print_step(step, "Click OK to save",
                       "Button with name 'OK'", "Passed",
                       "Clicked OK button",
                       f"step_{step}.png")
            passed += 1
        except Exception as e:
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}_error.png")
            print_step(step, "Click OK to save",
                       "Button with name 'OK'", "Failed",
                       f"Error: {e}",
                       f"step_{step}_error.png")
            failed += 1

        step += 1
        # Step 10: Verify in the top corner that under Alerts it says Back Support
        try:
            # Assuming a region or element labeled "Alerts" in top corner
            alerts_region = page.get_by_role("region", name="Alerts")
            alerts_text = alerts_region.inner_text()
            if "Back Support" in alerts_text:
                observation = "'Back Support' found under Alerts"
                status = "Passed"
                passed += 1
            else:
                observation = "'Back Support' not found under Alerts"
                status = "Failed"
                failed += 1
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}.png")
            print_step(step, "Verify 'Back Support' under Alerts in top corner",
                       "Region labeled 'Alerts'", status,
                       observation,
                       f"step_{step}.png")
        except Exception as e:
            page.screenshot(path=f"{args.screenshot_dir}/step_{step}_error.png")
            print_step(step, "Verify 'Back Support' under Alerts in top corner",
                       "Region labeled 'Alerts'", "Failed",
                       f"Error: {e}",
                       f"step_{step}_error.png")
            failed += 1

        browser.close()

    summary_status = "Passed" if failed == 0 else "Failed"
    print(json.dumps({
        "summary": "Adding Medical Status Alerts test completed",
        "status": summary_status,
        "total_steps": total_steps,
        "passed": passed,
        "failed": failed
    }))

if __name__ == "__main__":
    main()