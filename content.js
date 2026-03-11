

console.log("Eko-project - Extension loaded!");


// ***************** Selectors *****************
const SELECTORS = {
    // PDP button
    pdpButton: "//a[contains(@href, 'www.walmart.com/ip')]",

    // Backstage button
    backstageButton: "//a[contains(@href, 'backstage')]",

    // Product under review section
    productUnderReviewExpandButton: '//div[@class="product-under-review"]/div/p-button[2]/button',

    // In Progress status tag
    inProgressTag: "//p-tag[contains(normalize-space(.), 'In Progress')]",

    // Ticket Sidebar
    ticketSidebar: '//div[@role="complementary"]',

    // Ticket sidebar bavkground mask
    ticketSidebarMask: '.p-drawer-mask',

    // Ticket modal
    ticketModal: '//div/span[contains(text(), "Create Ticket")]/../..',

    // Ticket modal resize handle
    ticketModalResizeHandle: '.p-resizable-handle',

    // Ticket modal header
    ticketModalHeader: '.p-dialog-header',

    // Tickets button
    ticketsButton: '//button[contains(text(), "Tickets")]',

    // Ticket close sidebar button
    ticketCloseSidebarButton: '//p-button[contains(@data-pc-section, "closebutton")]/button',

    // Create Ticket button inside modal
    createTicketButton: '//span[contains(text(), "Create Ticket")]/..',

    // Modal backdrop overlay
    modalBackdrop: '//div[contains(@class, "p-dialog-mask")]',

    // Step questions body container
    stepQuestionsBody: '.step-questions-body',

    // expand button container
    expandContainer: '//div[@class="product-under-review"]/div/p-button[1]',

    // Container for products under review - used for footer label injection
    productUnderReviewContainer: '.products-under-review',

    // Current active step in the sidebar - used for extracting step number to add to description
    currentActiveStep: '//li[contains(@class, "active")]/div[@class="step-content"]/span[contains(@class, "active")]'
}




// ***************** Main Logic *****************
// Hotkey: Open live PDP on hotkey cmd+shift+7
document.addEventListener("keydown", (e) => {
  if (e.metaKey && e.shiftKey && e.key === "7") {
    clickButton(SELECTORS.pdpButton);
  }
});

// Hotkey: Open Backstage on hotkey cmd+shift+8
document.addEventListener("keydown", (e) => {
  if (e.metaKey && e.shiftKey && e.key === "8") {
    clickButton(SELECTORS.backstageButton);
  }
});

injectSidebarHider();

// Auto-Expand "Product Under Review" section
waitForXPath(SELECTORS.productUnderReviewExpandButton,
  () => {
    clickButton('//div[@class="product-under-review"]/div/p-button[2]/button');
    }
);

// Watch for "In Progress" status and trigger ticket popup and move to container containing questions
waitForXPath(
  SELECTORS.inProgressTag,
  () => {
    console.log("In Progress detected");
    runActions();
  }
); 

// Step keyboard navigation
initStepKeyboardNavigation();

// Super expand button
waitForControls();

// Super expand button shortcut
registerSuperExpandShortcut();

// Add active step to description field on hotkey
addActiveStepToDescriptionShortcut();

// Add label with shortcuts and extension version
injectEkoFooter(); 

// ***************** Main Logic *****************







// ***************** Modal/Popup stuff *****************
// Disable dragging of the modal by intercepting events and removing handles
function hardDisableDragging(modal) {
  const header = modal.querySelector(SELECTORS.ticketModalHeader);
  if (!header) return;

  // Stop drag from ever starting
  header.addEventListener(
    "mousedown",
    (e) => {
      e.stopImmediatePropagation();
      e.stopPropagation();
    },
    true
  );

  // Remove resize handle
  const resizeHandle = modal.querySelector(SELECTORS.ticketModalResizeHandle);
  if (resizeHandle) {
    resizeHandle.remove();
  }

  // Reset any transform that may have been applied
  modal.style.transform = "none";
  modal.style.top = "0";
  modal.style.left = "0";
}

function hideSidebarAndMaskPoll(interval = 1, timeout = 3000) {
    const start = Date.now();
    const timer = setInterval(() => {
        // Hide sidebar (XPath)
        const sidebar = getElementByXPath(SELECTORS.ticketSidebar);
        if (sidebar) sidebar.style.display = 'none';

        // Hide mask (CSS)
        const mask = document.querySelector(SELECTORS.ticketSidebarMask);
        if (mask) mask.style.display = 'none';

        if (Date.now() - start > timeout) clearInterval(timer);
    }, interval);
}

function showSidebarAndMask() {
    const sidebar = getElementByXPath(SELECTORS.ticketSidebar);
    if (sidebar) {
        sidebar.style.display = '';
    }

    const mask = document.querySelector(SELECTORS.ticketSidebarMask);
    if (mask) {
        mask.style.display = '';
    }
}

// Watch for modal removal to re-trigger the process when needed (e.g. after ticket creation)
function watchModalRemoval(modalXPath) {
  const observer = new MutationObserver(() => {
    const modal = document.evaluate(
      modalXPath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;

    if (!modal) {
        console.log("Modal removed, restoring sidebar");
        // showSidebar();
        showSidebarAndMask();
        observer.disconnect();
        waitForInProgressAndRestart();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Move the modal inside the target container and adjust styles to fit in seamlessly
function movePopup(modal) {
    console.log(`movePopup: ${modal}`)

    const target = document.querySelector(SELECTORS.stepQuestionsBody);

    if (!target) return;

    // Move modal inside target container
    target.appendChild(modal);

    // Remove blocking styles
    modal.style.position = "relative";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "auto";
    modal.style.zIndex = "1";
    modal.style.margin = "50px 0 0 0";

    // Remove backdrop overlay if exists
    const backdrop = getElementByXPath(SELECTORS.modalBackdrop)
    if (backdrop) backdrop.remove();

    // copy tickets after moving modal
    cloneTicketsBelowModal(modal);

    // Close ticket sidebar
    clickButton(SELECTORS.ticketCloseSidebarButton);

    // Re-enable page scroll
    document.body.style.overflow = "auto";
}

function cloneTicketsBelowModal(modal) {
    // Remove previously cloned tickets
    const existingWrapper = document.querySelector(".cloned-tickets-wrapper");
    if (existingWrapper) {
        existingWrapper.remove();
    }

    const tickets = document.querySelectorAll(".tickets-list .ticket-item");

    if (!tickets.length) {
        console.log("No tickets found — sidebar might not be fully rendered yet");
        return;
    }

    const ticketsWrapper = document.createElement("div");
    ticketsWrapper.className = "cloned-tickets-wrapper";
    ticketsWrapper.style.marginTop = "20px";

    // Flex layout
    ticketsWrapper.style.display = "flex";
    ticketsWrapper.style.flexWrap = "wrap";
    ticketsWrapper.style.gap = "10px";

    tickets.forEach(ticket => {
        const clonedTicket = ticket.cloneNode(true);

        // Hide buttons inside cloned ticket
        clonedTicket.querySelectorAll("button").forEach(btn => {
            btn.style.display = "none";
        });

        clonedTicket.style.width = "25%";
        clonedTicket.style.minWidth = "200px";
        clonedTicket.style.boxSizing = "border-box";
        clonedTicket.style.backgroundColor = "#f0f4f8";
        clonedTicket.style.border = "1px solid #ccc";
        clonedTicket.style.padding = "10px";
        clonedTicket.style.borderRadius = "6px";

        ticketsWrapper.appendChild(clonedTicket);
    });

    modal.after(ticketsWrapper);

    console.log(`Cloned ${tickets.length} tickets`);
}

// Watch for "In Progress" status and trigger ticket popup and move to container containing questions
function waitForInProgressAndRestart() {
    console.log("Restarting watcher for In Progress...");

    waitForXPathPoll(SELECTORS.inProgressTag,
      () => {
        console.log("In Progress detected again");
        runActions();
      }
    );
}

function injectSidebarHider() {
    if (document.getElementById("eko-sidebar-style")) return;

    const style = document.createElement("style");
    style.id = "eko-sidebar-style";
    style.textContent = `
        body.eko-hide-sidebar ${SELECTORS.ticketSidebar} {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
        }
    `;
    document.head.appendChild(style);
}

// Main function to run the sequence of actions: open tickets modal, move it, disable dragging, and watch for its removal
function runActions() {
    console.log(`runActions`)

    const button1 = SELECTORS.ticketsButton;
    const button2 = SELECTORS.createTicketButton;
    const modalXPath =  SELECTORS.ticketModal;

    // Hide sidebar and mask immediately and repeatedly to ensure they don't flash on screen before we hide them
    hideSidebarAndMaskPoll();

    // Click Tickets
    clickButton(button1);

    setTimeout(() => {
        // Click Create Ticket
        clickButton(button2);

        // Wait for modal to appear
        waitForXPath(modalXPath, (modal) => {
        movePopup(modal);
        hardDisableDragging(modal);
        watchModalRemoval(modalXPath);
        });

    }, 500);
} // ***************** Modal/Popup stuff *****************


// ******** Super expand button stuff ********
function injectSuperExpandStyle() {
    if (document.getElementById("eko-super-expand-style")) return;

    const style = document.createElement("style");
    style.id = "eko-super-expand-style";
    style.textContent = `
        .eko-super-expanded {
            width: 52vw !important;
            height: 65vh !important;
            max-width: none !important;
            max-height: none !important;
        }
    `;
    document.head.appendChild(style);
} 

function createSuperExpandButton() {
    const existingButtonWrapper = getElementByXPath(SELECTORS.expandContainer);
    if (!existingButtonWrapper) return;

    // Prevent duplicate injection
    if (document.querySelector(".eko-super-expand-btn")) return;

    const wrapper = document.createElement("p-button");
    wrapper.className = "eko-super-expand-btn";

    const button = document.createElement("button");
    button.type = "button";
    button.className =
        "p-ripple p-button p-button-icon-only p-button-secondary p-button-sm p-component";

    const icon = document.createElement("span");
    icon.className = "p-button-icon pi pi-external-link"; // initial icon

    button.appendChild(icon);
    wrapper.appendChild(button);

    button.addEventListener("click", triggerSuperExpand);

    // Insert the button after the existing expand button
    existingButtonWrapper.parentNode.appendChild(wrapper);
}

function triggerSuperExpand() {
    const player = document.querySelector(".eko-player-container");
    const button = document.querySelector(".eko-super-expand-btn button");
    const icon = button?.querySelector(".p-button-icon");

    if (!player) return;

    const isExpanded = player.classList.toggle("eko-super-expanded");

    if (icon) {
        icon.classList.toggle("pi-window-minimize", isExpanded);
        icon.classList.toggle("pi-external-link", !isExpanded);
    }
}

function waitForControls() {
    const observer = new MutationObserver(() => {
        const controls = document.querySelector("p-button.ms-auto");
        if (controls) {
            injectSuperExpandStyle();
            createSuperExpandButton();
            observer.disconnect();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
} 

function registerSuperExpandShortcut() {
    document.addEventListener("keydown", (event) => {
        if (event.metaKey && event.shiftKey && event.key.toLowerCase() === "0") {
            event.preventDefault();
            triggerSuperExpand();
        }
    });
} // ******** Super expand butto stuff ********


// ********** Step keyboard navigation: Listen for arrow key presses and navigate through substeps **********
function initStepKeyboardNavigation() {
    console.log("Step keyboard")
    document.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

        console.log("Step keyboard - key detected")

        const substeps = Array.from(
            document.querySelectorAll(".steps-list .substep-item")
        );

        if (!substeps.length) return;

        const active = document.querySelector(
            ".steps-list .substep-item.active"
        );

        let index = substeps.indexOf(active);

        if (index === -1) {
            // If nothing active, start from first
            index = 0;
        } else {
            if (e.key === "ArrowDown" && index < substeps.length - 1) {
                index++;
            }

            if (e.key === "ArrowUp" && index > 0) {
                index--;
            }
        }

        substeps[index].click();
        e.preventDefault();
    });
} // ********** Step keyboard navigation: Listen for arrow key presses and navigate through substeps **********


// ********** Add active step to description field on hotkey **********
function addActiveStepToDescriptionShortcut() {
    console.log("Add active step to description shortcut")
    document.addEventListener("keydown", function (e) {
        if (e.altKey && e.code === "KeyA") {

            e.preventDefault();
            if (e.repeat) return;

            const activeStep = document.evaluate(
                '//li[contains(@class, "active")]/div[@class="step-content"]/span[contains(@class, "active")]',
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            ).singleNodeValue;

            if (!activeStep) return;

            const stepText = activeStep.textContent.trim();
            const section = stepText.split(" ")[0];
            if (!section) return;

            const description = document.querySelector("textarea");
            if (!description) return;

            let value = description.value.trim();

            // Detect section list at beginning
            const match = value.match(/^(\d+(\.\d+)?(?:,\s*\d+(\.\d+)?)*)/);

            let sections = [];
            let text = value;

            if (match) {
                sections = match[0]
                    .split(",")
                    .map(s => s.trim())
                    .filter(Boolean);

                text = value.slice(match[0].length).trim();

                // remove optional dash
                text = text.replace(/^-\s*/, "");
            }

            const index = sections.indexOf(section);

            // Toggle section
            if (index !== -1) {
                sections.splice(index, 1);
            } else {
                sections.push(section);
            }

            // Sort sections numerically
            sections.sort((a, b) => {
                const pa = a.split(".").map(Number);
                const pb = b.split(".").map(Number);

                for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
                    const na = pa[i] || 0;
                    const nb = pb[i] || 0;
                    if (na !== nb) return na - nb;
                }
                return 0;
            });

            const sectionText = sections.join(", ");

            let newValue = "";

            if (sectionText && text) {
                newValue = sectionText + " - " + text;
            } else if (sectionText) {
                newValue = sectionText + " - ";
            } else {
                newValue = text;
            }

            description.value = newValue;

            description.dispatchEvent(new Event("input", { bubbles: true }));
        }
    });
} // ********** Add active step to description field on hotkey **********


// ************ Footer version label + shortcuts tooltip ************
function injectEkoFooter() {
    const shortcuts = [
        "Option+A → Add section to description",
        "Arrow up/down → Navigate sections",
        "Cmd+Shift+7 → Open live PDP",
        "Cmd+Shift+8 → Open Backstage",
        "Cmd+Shift+0 → Super expand/collapse player"
    ];

    const observer = new MutationObserver((mutations, obs) => {
        const container = document.querySelector('.product-under-review');
        if (container) {
            if (!container.querySelector('.eko-footer')) {
                const version = chrome.runtime.getManifest().version;

                const footerWrapper = document.createElement('div');
                footerWrapper.className = 'eko-footer';
                footerWrapper.style.marginTop = 'auto';
                footerWrapper.style.textAlign = 'center';
                footerWrapper.style.fontWeight = 'bold';
                footerWrapper.style.padding = '10px 0';
                footerWrapper.style.fontSize = '12px';
                footerWrapper.style.color = '#d7d7d7';
                footerWrapper.style.display = 'flex';
                footerWrapper.style.flexDirection = 'column';
                footerWrapper.style.alignItems = 'center';
                footerWrapper.style.position = 'relative';

                const labelContainer = document.createElement('div');
                labelContainer.style.display = 'flex';
                labelContainer.style.alignItems = 'center';
                labelContainer.style.gap = '6px';

                const versionLabel = document.createElement('div');
                versionLabel.textContent = `EkoBro 🦎 ${version}`;

                // Neutral help icon (SVG)
                const helpIcon = document.createElement('div');
                helpIcon.style.cursor = 'default';
                helpIcon.style.display = 'flex';
                helpIcon.style.alignItems = 'center';

                helpIcon.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d7d7d7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.5 1-1.5 2"></path>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                `;

                // Tooltip
                const tooltip = document.createElement('div');
                tooltip.style.position = 'absolute';
                tooltip.style.bottom = '35px';
                tooltip.style.background = '#2b2b2b';
                tooltip.style.border = '1px solid #444';
                tooltip.style.borderRadius = '6px';
                tooltip.style.padding = '8px 10px';
                tooltip.style.fontWeight = 'normal';
                tooltip.style.fontSize = '12px';
                tooltip.style.color = '#d7d7d7';
                tooltip.style.textAlign = 'left';
                tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
                tooltip.style.minWidth = '220px';
                tooltip.style.opacity = '0';
                tooltip.style.pointerEvents = 'none';
                tooltip.style.transition = 'opacity 0.15s ease';
                tooltip.style.zIndex = '9999';

                shortcuts.forEach(hotkey => {
                    const div = document.createElement('div');
                    div.textContent = hotkey;
                    tooltip.appendChild(div);
                });

                // Hover behavior
                helpIcon.addEventListener('mouseenter', () => {
                    tooltip.style.opacity = '1';
                });

                helpIcon.addEventListener('mouseleave', () => {
                    tooltip.style.opacity = '0';
                });

                labelContainer.appendChild(versionLabel);
                labelContainer.appendChild(helpIcon);

                footerWrapper.appendChild(labelContainer);
                footerWrapper.appendChild(tooltip);

                container.style.display = 'flex';
                container.style.flexDirection = 'column';

                container.appendChild(footerWrapper);
            }
            obs.disconnect();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
} // ************ Footer version label + shortcuts tooltip ************


// ***************** helper/utilities stuff *****************
// Supports both CSS selectors and XPath expressions
function clickButton(selector) {
    console.log(`clickButton: ${selector}`)
    let el;

    if (selector.startsWith("//")) {
        el = document.evaluate(
        selector,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
        ).singleNodeValue;
    } else {
        el = document.querySelector(selector);
    }

    if (el) el.click();
}


// Tickets popup to DOM - Check if the page contains "In Progress"
function getElementByXPath(xpath) {
    console.log(`getElementByXPath: ${xpath}`)

    return document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
    ).singleNodeValue;
}


function waitForXPath(xpath, callback) {
    console.log(`waitForXpath: ${xpath}`)
    const observer = new MutationObserver(() => {
        const el = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
        ).singleNodeValue;

        if (el) {
        console.log("Found element:", el);
        observer.disconnect();
        callback(el);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
    }


function waitForXPathPoll(xpath, callback, interval = 200, timeout = 5000) {
    const start = Date.now();

    const timer = setInterval(() => {
        const el = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;

        if (el) {
            clearInterval(timer);
            callback(el);
        } else if (Date.now() - start > timeout) {
            clearInterval(timer);
            console.log("Timeout waiting for XPath:", xpath);
        }
    }, interval);
} // ***************** helper/utilities stuff *****************


