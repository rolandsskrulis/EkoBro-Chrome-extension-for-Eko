

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
    productUnderReviewContainer: '.products-under-review'
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

// Add label with extension version
injectEkoVersion(); 

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
            btn.style.display = "none"; // must be lowercase 'none'
        });

        // Styles
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


// ************ Footer version label ************
function injectEkoVersion() {
    const observer = new MutationObserver((mutations, obs) => {
        const container = document.querySelector('.product-under-review');
        if (container) {
            // Avoid adding duplicates
            if (!container.querySelector('.eko-version-label')) {
                const version = chrome.runtime.getManifest().version;
                const versionLabel = document.createElement('div');
                versionLabel.className = 'eko-version-label';
                versionLabel.textContent = `EkoBro 🦎 ${version}`;
                
                // Style to stay at the bottom
                versionLabel.style.marginTop = 'auto';
                versionLabel.style.textAlign = 'center';
                versionLabel.style.fontWeight = 'bold';
                versionLabel.style.padding = '10px 0';
                versionLabel.style.fontSize = '12px';
                versionLabel.style.color = '#d7d7d7';

                container.style.display = 'flex';
                container.style.flexDirection = 'column';

                container.appendChild(versionLabel);
            }
            obs.disconnect(); // stop observing once added
        }
    });

    // Start observing the DOM
    observer.observe(document.body, { childList: true, subtree: true });
}// ************ Footer version label ************


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


