document.addEventListener('DOMContentLoaded', () => {
    // Navbar scroll effect
    const navbar = document.getElementById('navbar');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
            // Change logo and link colors for white bg
            navbar.style.color = "var(--primary-color)";
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add elements visibility animation on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = "1";
                entry.target.style.transform = "translateY(0)";
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Initial style for animating elements
    const styleAnimateElement = (el) => {
        el.style.opacity = "0";
        el.style.transform = "translateY(30px)";
        el.style.transition = "opacity 0.8s ease, transform 0.8s ease";
    };

    const processCards = document.querySelectorAll('.process-card');
    const productCards = document.querySelectorAll('.product-card');

    processCards.forEach(card => {
        styleAnimateElement(card);
        observer.observe(card);
    });

    productCards.forEach((card, index) => {
        styleAnimateElement(card);
        // Add slight delay for staggered grid load
        card.style.transitionDelay = `${index * 0.1}s`;
        observer.observe(card);
    });

    // --- Flipkart Type Interaction Logic ---

    // --- Flipkart Type Interaction Logic ---
    let cart = []; // Store actual cart items { id, name, price, quantity }
    let selectedProduct = "";
    let currentOrderTotal = "₹0";
    let checkoutItems = [];
    let inventoryData = {};
    const cartCountEl = document.getElementById('cart-count');
    const cartIconNav = document.querySelector('.btn-cart-nav');

    // Pack & Price selection elements (hoisted for scope)
    const packOptions = document.querySelectorAll('#pack-options .selection-btn');
    const qtyOptions = document.querySelectorAll('#qty-options .selection-btn');
    const packLabel = document.getElementById('selected-pack-label');
    const qtyLabel = document.getElementById('selected-qty-label');
    const modalPriceEl = document.getElementById('modal-price');
    let basePriceValue = 0;

    function updateModalPrice() {
        if (basePriceValue === 0) return;

        const packMultiplier = parseInt(packLabel.innerText) || 1;
        const qtyValue = parseInt(qtyLabel.innerText) || 100;
        const qtyMultiplier = qtyValue / 100;

        const finalPrice = Math.round(basePriceValue * packMultiplier * qtyMultiplier);
        modalPriceEl.innerText = `₹${finalPrice}`;
    }

    const updateStockUI = () => {
        document.querySelectorAll('.product-card').forEach(card => {
            const productId = card.getAttribute('data-product-id');
            const item = inventoryData[productId];
            if (item) {
                const { stock, threshold } = item;
                
                // Clear any existing stock badges
                const existingBadge = card.querySelector('.stock-badge');
                if (existingBadge) existingBadge.remove();
                
                const addBtn = card.querySelector('.add-to-cart');
                const buyBtn = card.querySelector('.buy-now');
                
                if (stock === 0) {
                    card.classList.add('out-of-stock');
                    const badge = document.createElement('div');
                    badge.className = 'stock-badge out-of-stock';
                    badge.innerText = 'Out of Stock';
                    card.querySelector('.img-wrapper').appendChild(badge);
                    
                    if (addBtn) { addBtn.disabled = true; addBtn.innerText = 'Out of Stock'; }
                    if (buyBtn) { buyBtn.disabled = true; buyBtn.style.display = 'none'; }
                } else if (stock <= threshold) {
                    card.classList.remove('out-of-stock');
                    const badge = document.createElement('div');
                    badge.className = 'stock-badge low-stock';
                    badge.innerText = `Only ${stock} left!`;
                    card.querySelector('.img-wrapper').appendChild(badge);
                    
                    if (addBtn) { addBtn.disabled = false; addBtn.innerText = 'Add to Cart'; }
                    if (buyBtn) { buyBtn.disabled = false; buyBtn.style.display = 'inline-block'; }
                } else {
                    card.classList.remove('out-of-stock');
                    if (addBtn) { addBtn.disabled = false; addBtn.innerText = 'Add to Cart'; }
                    if (buyBtn) { buyBtn.disabled = false; buyBtn.style.display = 'inline-block'; }
                }
            }
        });
    };

    const fetchInventoryData = async () => {
        try {
            const res = await fetch('/api/inventory');
            if (res.ok) {
                inventoryData = await res.json();
                updateStockUI();
            }
        } catch (err) {
            console.error("Error fetching inventory:", err);
        }
    };

    // Load inventory stock data on startup
    fetchInventoryData();

    // Sidebar Elements
    const cartSidebar = document.getElementById('cart-sidebar');
    const openCartBtn = document.getElementById('open-cart');
    const closeCartBtn = document.getElementById('close-cart');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartTotalEl = document.getElementById('cart-total');
    const cartCheckoutBtn = document.getElementById('cart-checkout-btn');

    // Modals & Elements
    const orderModal = document.getElementById('order-modal');
    const successModal = document.getElementById('success-modal');
    const orderSummaryBox = document.getElementById('order-summary-box');
    const checkoutForm = document.getElementById('checkout-form');

    const closeModalX = document.getElementById('close-modal-x');
    const closeSuccessBtn = document.getElementById('close-success');

    // --- Sidebar Toggle ---
    openCartBtn.addEventListener('click', () => {
        cartSidebar.classList.add('active');
        document.body.classList.add('cart-open');
    });
    closeCartBtn.addEventListener('click', () => {
        cartSidebar.classList.remove('active');
        document.body.classList.remove('cart-open');
    });

    // --- Cart Manipulation ---
    const updateCartUI = () => {
        cartCountEl.innerText = cart.length;
        cartItemsContainer.innerHTML = '';

        let total = 0;

        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-msg">Your cart is empty.</p>';
        } else {
            cart.forEach((item, index) => {
                const priceValue = parseInt(item.price.replace('₹', ''));
                total += priceValue;

                const itemEl = document.createElement('div');
                itemEl.className = 'cart-item';
                itemEl.innerHTML = `
                    <div class="item-details">
                        <h4>${item.name}</h4>
                        <p>${item.price}</p>
                    </div>
                    <button class="remove-item" onclick="removeFromCart(${index})">Remove</button>
                `;
                cartItemsContainer.appendChild(itemEl);
            });
        }

        cartTotalEl.innerText = `₹${total}`;
    };

    window.removeFromCart = (index) => {
        cart.splice(index, 1);
        updateCartUI();
    };

    // Function to handle Fly to Cart Animation
    const animateFlyToCart = (imgElement, productName, productPrice, productId, quantity = 1) => {
        const cartPos = cartIconNav.getBoundingClientRect();
        const imgPos = imgElement.getBoundingClientRect();

        const clone = imgElement.cloneNode(true);
        clone.className = 'fly-item';
        clone.style.top = `${imgPos.top}px`;
        clone.style.left = `${imgPos.left}px`;
        clone.style.width = `${imgPos.width}px`;
        clone.style.height = `${imgPos.height}px`;

        document.body.appendChild(clone);

        setTimeout(() => {
            clone.style.top = `${cartPos.top}px`;
            clone.style.left = `${cartPos.left}px`;
            clone.style.width = '20px';
            clone.style.height = '20px';
            clone.style.opacity = '0';
        }, 10);

        setTimeout(() => {
            clone.remove();
            cart.push({ id: productId, name: productName, price: productPrice, quantity: quantity });
            updateCartUI();

            cartIconNav.style.transform = 'scale(1.3)';
            setTimeout(() => cartIconNav.style.transform = 'scale(1)', 200);
        }, 800);
    };

    // Add to Cart Event
    document.querySelectorAll('.add-to-cart').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.product-card');
            const modal = e.target.closest('.product-modal');

            let img, name, price, productId, quantity = 1;

            if (card) {
                img = card.querySelector('img');
                name = card.querySelector('h3').innerText;
                price = card.querySelector('.price').innerText;
                productId = card.getAttribute('data-product-id');
            } else if (modal) {
                img = modal.querySelector('#modal-img');
                let baseName = modal.querySelector('#modal-title').innerText;

                // Get selected pack and qty
                const selectedPack = modal.querySelector('#selected-pack-label').innerText;
                const selectedQty = modal.querySelector('#selected-qty-label').innerText;
                name = `${baseName} - ${selectedQty} (Pack of ${selectedPack})`;

                price = modal.querySelector('#modal-price').innerText;
                productId = modal.getAttribute('data-active-product-id');
                quantity = parseInt(selectedPack) || 1;

                // Close modal after adding to cart for better flow
                closeModal();
            }

            if (img && name && price && productId) {
                animateFlyToCart(img, name, price, productId, quantity);
            }
        });
    });

    // Buy Now Event (Direct Checkout)
    document.querySelectorAll('.buy-now').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.product-card');
            const modal = e.target.closest('.product-modal');

            let name, price, productId, quantity = 1;

            if (card) {
                name = card.querySelector('h3').innerText;
                price = card.querySelector('.price').innerText;
                productId = card.getAttribute('data-product-id');
            } else if (modal) {
                let baseName = modal.querySelector('#modal-title').innerText;
                const selectedPack = modal.querySelector('#selected-pack-label').innerText;
                const selectedQty = modal.querySelector('#selected-qty-label').innerText;
                name = `${baseName} - ${selectedQty} (Pack of ${selectedPack})`;

                price = modal.querySelector('#modal-price').innerText;
                productId = modal.getAttribute('data-active-product-id');
                quantity = parseInt(selectedPack) || 1;
                closeModal();
            }

            if (name && price && productId) {
                selectedProduct = name; // For subject line
                currentOrderTotal = price; // Store actual total
                orderSummaryBox.innerHTML = `🛒 Item: <strong>${name}</strong><br>💰 Individual Price: <strong>${price}</strong>`;
                
                // Track item for direct checkout
                checkoutItems = [{ id: productId, name: name, price: price, quantity: quantity }];
                
                orderModal.classList.add('active');
            }
        });
    });

    // Sidebar Checkout Event
    cartCheckoutBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            alert("Your cart is empty! Add something first.");
            return;
        }

        const names = cart.map(item => item.name).join(', ');
        selectedProduct = names; // For subject line
        const total = cartTotalEl.innerText;
        currentOrderTotal = total; // Store actual total

        orderSummaryBox.innerHTML = `🛒 Items: <strong>${names}</strong><br>💰 Grand Total: <strong>${total}</strong>`;
        
        // Track items for cart checkout
        checkoutItems = cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
        }));
        
        cartSidebar.classList.remove('active');
        document.body.classList.remove('cart-open');
        orderModal.classList.add('active');
    });

    // --- Dynamic "Other" Department Field ---
    const deptSelect = document.getElementById('faculty-dept');
    const otherDeptGroup = document.getElementById('other-dept-group');
    const otherDeptInput = document.getElementById('faculty-dept-other');

    deptSelect.addEventListener('change', () => {
        if (deptSelect.value === 'Other') {
            otherDeptGroup.classList.remove('hidden');
            otherDeptInput.required = true;
        } else {
            otherDeptGroup.classList.add('hidden');
            otherDeptInput.required = false;
        }
    });

    // Handle Form Submission (Direct for reliability)
    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerText;
        submitBtn.innerText = "Processing Order...";
        submitBtn.disabled = true;

        let finalDept = deptSelect.value;
        if (finalDept === 'Other') {
            finalDept = otherDeptInput.value;
        }

        const formUrl = "https://formspree.io/janardhanrao1609@gmail.com";

        const data = new FormData();
        data.append("Faculty Name", document.getElementById('faculty-name').value);
        data.append("Department", finalDept);
        data.append("Mobile", document.getElementById('faculty-mobile').value);
        data.append("Email", document.getElementById('faculty-email').value);
        data.append("Ordered Product(s)", selectedProduct);
        data.append("Grand Total", document.getElementById('cart-total').innerText);
        data.append("_subject", `SUN FRESH ORDER: ${selectedProduct}`);

        const orderPayload = {
            customerName: document.getElementById('faculty-name').value,
            department: finalDept,
            mobile: document.getElementById('faculty-mobile').value,
            email: document.getElementById('faculty-email').value,
            products: selectedProduct,
            total: currentOrderTotal,
            items: checkoutItems
        };

        try {
            // 1. Save to Local Backend for Admin Dashboard
            console.log("Saving order to local backend...", orderPayload);
            const localResponse = await fetch('/api/orders/create', {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            });

            if(localResponse.ok) console.log("Local order saved successfully!");

            // 2. Original Formspree Notification
            const response = await fetch(formUrl, {
                method: "POST",
                body: data,
                headers: { 'Accept': 'application/json' }
            });

            if (response.ok || localResponse.ok) {
                orderModal.classList.remove('active');
                successModal.classList.add('active');
                checkoutForm.reset();
                cart = []; // Clear cart on success
                updateCartUI();
                fetchInventoryData(); // Re-fetch inventory stock to update indicators
            } else {
                throw new Error("Order failed");
            }
        } catch (error) {
            // Fallback to direct Formspree submission if fetch fails
            const fallbackForm = document.createElement('form');
            fallbackForm.method = 'POST';
            fallbackForm.action = formUrl;
            for (const [key, value] of data.entries()) {
                const input = document.createElement('input');
                input.type = 'hidden'; input.name = key; input.value = value;
                fallbackForm.appendChild(input);
            }
            document.body.appendChild(fallbackForm);
            fallbackForm.submit();
        } finally {
            submitBtn.innerText = originalBtnText;
            submitBtn.disabled = false;
        }
    });

    // Close Modals
    [closeModalX, closeSuccessBtn].forEach(btn => {
        btn.addEventListener('click', () => {
            orderModal.classList.remove('active');
            successModal.classList.remove('active');
        });
    });

    [orderModal, successModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // --- Feedback / Review Form Submission ---
    const feedbackForm = document.getElementById('feedback-form');

    feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerText;
        submitBtn.innerText = "Sending Review...";
        submitBtn.disabled = true;

        const data = new FormData();
        data.append("User Name", document.getElementById('review-name').value);
        data.append("Department/Designation", document.getElementById('review-dept').value);
        data.append("Feedback Message", document.getElementById('review-message').value);
        data.append("_subject", "NEW USER REVIEW - Sun Fresh Naturals");

        try {
            const response = await fetch("https://formspree.io/janardhanrao1609@gmail.com", {
                method: "POST",
                body: data,
                headers: { 'Accept': 'application/json' }
            });

            if (response.ok) {
                alert("Thank you for your feedback! It means a lot to us.");
                feedbackForm.reset();
            } else {
                alert("Could not send feedback at this moment. Please try again later.");
            }
        } catch (error) {
            alert("Connection error. Ensure you are connected to the internet.");
        } finally {
            submitBtn.innerText = originalBtnText;
            submitBtn.disabled = false;
        }
    });

    // --- Order Tracker Simulation ---
    const trackerModal = document.getElementById('tracker-modal');
    const trackOrderLink = document.getElementById('track-order-link');
    const closeTrackerX = document.getElementById('close-tracker-x');
    const trackSubmitBtn = document.getElementById('btn-track-submit');
    const trackInput = document.getElementById('track-mobile');

    const trackerLoading = document.getElementById('tracker-loading');
    const trackerResults = document.getElementById('tracker-results');

    const trackSteps = [
        document.getElementById('step-1'),
        document.getElementById('step-2'),
        document.getElementById('step-3'),
        document.getElementById('step-4')
    ];
    const statusDesc = document.getElementById('status-desc');
    const resMobile = document.getElementById('res-mobile');

    trackOrderLink.addEventListener('click', (e) => {
        e.preventDefault();
        trackerModal.classList.add('active');
        trackerResults.classList.add('hidden');
    });

    closeTrackerX.addEventListener('click', () => {
        trackerModal.classList.remove('active');
    });

    trackSubmitBtn.addEventListener('click', () => {
        const val = trackInput.value.trim();
        if (val.length < 10) {
            alert("Please enter a valid 10-digit mobile number!");
            return;
        }

        // Show loading state
        trackSubmitBtn.disabled = true;
        trackerLoading.classList.remove('hidden');
        trackerResults.classList.add('hidden');

        // Simulate server connection
        setTimeout(() => {
            trackerLoading.classList.add('hidden');
            trackerResults.classList.remove('hidden');
            trackSubmitBtn.disabled = false;

            resMobile.innerText = val;

            // Randomly choose a status for simulation
            const randomStatus = Math.floor(Math.random() * 4);
            const messages = [
                "Your order has been confirmed and added to our batch queue.",
                "Today is a sunny day! Your product is currently in the solar dry box.",
                "The solar drying is complete. We are now filtering and checking quality.",
                "Your order is verified! Our team is delivering it to your department office now."
            ];

            // Update UI status steps
            trackSteps.forEach((step, idx) => {
                if (idx <= randomStatus) {
                    step.classList.add('active');
                } else {
                    step.classList.remove('active');
                }
            });
            statusDesc.innerText = messages[randomStatus];

        }, 1500);
    });

    // --- Category Branch Selection Logic ---
    const categoryCards = document.querySelectorAll('.category-card');
    const categorySelection = document.getElementById('category-selection');
    const productView = document.getElementById('product-view');
    const backToCatsBtn = document.getElementById('back-to-categories');
    const categoryTitle = document.getElementById('current-category-title');

    categoryCards.forEach(card => {
        card.addEventListener('click', () => {
            const category = card.getAttribute('data-category');

            // Update Title
            categoryTitle.innerText = category === 'leaves' ? 'Botanical Leaves Branch' : 'Natural Powders Branch';

            // Filter products
            productCards.forEach(pCard => {
                if (pCard.getAttribute('data-category') === category) {
                    pCard.classList.remove('hidden');
                    pCard.style.display = 'block';
                    pCard.style.opacity = '1';
                } else {
                    pCard.classList.add('hidden');
                    pCard.style.display = 'none';
                }
            });

            // Switch views
            categorySelection.classList.add('hidden');
            productView.classList.remove('hidden');

            // Scroll to view
            productView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    backToCatsBtn.addEventListener('click', () => {
        productView.classList.add('hidden');
        categorySelection.classList.remove('hidden');
        categorySelection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    // Handle Hero "Explore Products" button
    const exploreBtn = document.querySelector('a[href="#shop"]');
    if (exploreBtn) {
        exploreBtn.addEventListener('click', (e) => {
            e.preventDefault();
            categorySelection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    // Close on outside click for tracker
    trackerModal.addEventListener('click', (e) => {
        if (e.target === trackerModal) trackerModal.classList.remove('active');
    });

    // --- Product Detail Modal Logic ---
    const productModal = document.getElementById('product-modal');
    const modalClose = document.querySelector('.modal-close');

    // Detailed Product Matter (Flipkart Style)
    const productDetails = {
        "coconut-oil": {
            benefits: "Supports heart health, improves skin texture, and provides immediate energy via MCTs.",
            idealFor: "Health-conscious families, skin-care enthusiasts, and traditional Indian kitchens.",
            advantages: "Solar-dried extraction preserves 100% of the lauric acid which industrial heat destroys.",
            prep: "Use as a cooking medium or apply directly to hair and skin as a natural moisturizer.",
            dosage: "1-2 tablespoons daily in cooking or 1 teaspoon raw for metabolic health.",
            tasteTip: "Has a mild, sweet nutty aroma. No sugar needed as it's used for cooking/application.",
            description: "Our Extra Pure Solar-Dried Coconut Oil is processed using a unique solar chamber technology. We carefully select the finest coconuts, which are then slowly dried to retain their natural lauric acid and distinct aroma. Unlike industrial oils, ours is never subjected to high heat or chemicals.",
            highlights: ["100% Cold Pressed", "Solar Dried Copra", "No Added Preservatives", "Rich in Lauric Acid"],
            specs: { "Type": "Cooking/Hair Oil", "Quantity": "500ml", "Shelf Life": "12 Months", "Organic": "Yes" },
            reviews: [
                { user: "Prof. Anjali", comment: "The aroma is just wonderful. Reminds me of traditional home-made oil." },
                { user: "Dr. Ramesh", comment: "Very pure and high quality. Highly recommended for cooking." }
            ]
        },
        "moringa-vitality": {
            benefits: "Rich in antioxidants, supports immune system, and helps in managing blood sugar levels.",
            idealFor: "Students, elderly people, and those with iron deficiency.",
            advantages: "Controlled solar drying keeps the green chlorophyll alive, making it 2x more potent.",
            prep: "Mix with warm water, juice, or add to your morning smoothie or dal.",
            dosage: "1 teaspoon (5g) twice a day—once in the morning and once before bed.",
            tasteTip: "It has an earthy, leaf-like taste. You can add honey or a little jaggery to make it delicious.",
            description: "The Vitality Tree (Moringa) is known as a nutritional powerhouse. Our powder is created from 100% natural leaves that are solar-dried to lock in chlorophyll, vitamins, and minerals. It's a fine, vibrant green powder that blends easily into any diet.",
            highlights: ["Energy Booster", "Rich in Iron & Calcium", "Solar Dried for Nutrients", "Finely Milled"],
            specs: { "Form": "Powder", "Quantity": "250g", "Shelf Life": "6 Months", "Vitamins": "A, C, E" },
            reviews: [
                { user: "Dean K. Sastry", comment: "Started using this in my morning smoothies. Feel much more energetic." },
                { user: "Suresh (Student)", comment: "Great for health, easy to mix." }
            ]
        },
        "curry-leaves": {
            benefits: "Promotes hair growth, prevents premature greying, and aids in digestive health.",
            idealFor: "Anyone facing hair fall issues or indigestion.",
            advantages: "Preserves the essential oils that give curry leaves their medicinal power.",
            prep: "Mix with buttermilk, warm water, or sprinkle on top of your curries.",
            dosage: "Half a teaspoon twice daily after meals.",
            tasteTip: "Tastes naturally aromatic. Goes very well with a pinch of salt and buttermilk.",
            description: "Premium garden-fresh curry leaves are meticulously processed and solar-dried to preserve their natural essential oils. This powder is a perfect culinary aid that adds both health and flavor to your traditional dishes.",
            highlights: ["Natural Aroma", "Antioxidant Rich", "Pure Culinary Grade", "Iron Supplement"],
            specs: { "Form": "Powder", "Quantity": "100g", "Shelf Life": "6 Months", "Flavor": "Pungent/Nutty" },
            reviews: [
                { user: "Ms. Lakshmi", comment: "Very fresh aroma. Much better than the store-bought ones." }
            ]
        },
        "guava-leaves": {
            benefits: "Excellent for weight management and managing blood glucose levels.",
            idealFor: "Diabetic patients and those on a weight loss journey.",
            advantages: "High-concentration solar extraction ensures no loss of natural tannins.",
            prep: "Add to boiling water to make a herbal tea. Strain and drink.",
            dosage: "1 cup of guava tea twice a day, preferably before meals.",
            tasteTip: "Has a slight herbal bitterness. Adding a drop of lemon or honey enhances the taste.",
            description: "Our Guava Leaves Powder is a high-purity botanical supplement. Prepared using controlled solar energy, it retains its natural tannins and medicinal properties often used for digestive wellness and blood sugar support.",
            highlights: ["Digestive Support", "Natural Tannins", "Solar Extraction", "Pure Botanical"],
            specs: { "Form": "Powder", "Quantity": "100g", "Shelf Life": "6 Months", "Usage": "Herbal Tea/Supplement" },
            reviews: [
                { user: "Dr. Vardhan", comment: "Effective for digestive issues. Good initiative by Sun Fresh." }
            ]
        },
        "neem-powder": {
            benefits: "Purifies blood, clears skin acne, and acts as a powerful anti-microbial agent.",
            idealFor: "Teenagers with skin issues and adults looking for detoxification.",
            advantages: "Traditional purity maintained without any industrial processing or chemicals.",
            prep: "Mix with a small amount of warm water to form a paste or drink as a shot.",
            dosage: "Half a teaspoon once a day in the morning on an empty stomach.",
            tasteTip: "It is naturally bitter. It is best taken quickly with water, or you can add a little bit of honey.",
            description: "A premium bitter-clean wellness supplement. Neem is globally recognized for its blood-purifying and anti-fungal properties. Our solar-drying process ensures the natural alkaloids remain active.",
            highlights: ["Blood Purifier", "Anti-Fungal", "Traditional Ayurveda", "Solar Processed"],
            specs: { "Form": "Powder", "Quantity": "100g", "Shelf Life": "9 Months", "Purity": "100%" },
            reviews: [
                { user: "Prof. Reddy", comment: "Authentic neem taste. Definitely pure." }
            ]
        },
        "betel-leaves": {
            benefits: "Instant relief from bloating, supports oral hygiene, and rich in calcium.",
            idealFor: "People with slow digestion or gastric issues.",
            advantages: "Solar drying removes moisture while keeping the pepper-like medicinal compounds active.",
            prep: "Mix with warm water or add to a glass of warm milk.",
            dosage: "1 teaspoon once a day after dinner.",
            tasteTip: "Has a sharp, peppery taste. Can be taken with honey or added to milk for a smoother flavor.",
            description: "Organic Betel Leaves are solar-dried and powdered to support digestion and oral health. This iron-rich formula is 100% natural and processed without any artificial heat.",
            highlights: ["Oral Health", "Digestive Aid", "Iron Rich", "100% Organic"],
            specs: { "Form": "Powder", "Quantity": "100g", "Shelf Life": "6 Months", "Flavor": "Peppery" },
            reviews: [
                { user: "Mr. Satyam", comment: "Excellent for post-meal digestion." }
            ]
        },
        "mango-powder": {
            benefits: "High in Vitamin A and C, improves digestion and skin health.",
            idealFor: "Children for immunity and home cooks for flavor.",
            advantages: "Naturally golden color preserved without any synthetic dyes.",
            prep: "Add to fruit juices, salads, or use as a tang in your dal and curries.",
            dosage: "1-2 teaspoons daily as part of your meals.",
            tasteTip: "Tastes naturally tangy and sweet. No extra sugar needed usually.",
            description: "Naturally golden mango powder, solar-dried to retain its vitamins, enzymes, and immunity-boosting properties. It adds a delicious tangy flavor to your recipes.",
            highlights: ["Immunity Boost", "Vitamin A Rich", "Tangy Flavor", "Solar Dried"],
            specs: { "Form": "Powder", "Quantity": "100g", "Shelf Life": "8 Months", "Ingredients": "Solar-Dried Mango" },
            reviews: [
                { user: "Chef Rajesh", comment: "Adds a very natural tang to my dishes. Love it." }
            ]
        },
        "mint-powder": {
            benefits: "Cools the body, improves focus, and provides relief from nausea.",
            idealFor: "Commuters, students, and during hot summer days.",
            advantages: "The cooling menthol is preserved by avoiding high-temperature industrial drying.",
            prep: "Mix with cold water for a refreshing drink or add to curd/yogurt.",
            dosage: "1 teaspoon in a glass of water, twice daily.",
            tasteTip: "Very refreshing. Add a little lemon and a pinch of sugar for a perfect mint cooler.",
            description: "Refreshing and vibrant mint leaves are solar-dried and finely ground to ensure maximum aroma. Perfect for beverages, chutneys, and digestive support.",
            highlights: ["Fresh Aroma", "Cooling Effect", "Digestive Support", "100% Pure"],
            specs: { "Form": "Powder", "Quantity": "100g", "Shelf Life": "6 Months", "Flavor": "Minty Fresh" },
            reviews: [
                { user: "Ms. Priyanka", comment: "Makes the best mint tea! So fresh." }
            ]
        },
        "coriander-powder": {
            benefits: "Aids digestion, reduces skin inflammation, and rich in dietary fiber.",
            idealFor: "Daily culinary use for a healthy gut.",
            advantages: "Solar-dried coriander is more aromatic and requires 30% less quantity in cooking.",
            prep: "Use as a base spice for all your gravies and vegetable stir-fries.",
            dosage: "1-2 teaspoons per meal for a family of four.",
            tasteTip: "Mild and earthy. No sugar needed; enhances the natural sweetness of vegetables.",
            description: "A staple botanical processed under perfect solar conditions to preserve its distinct flavor profile and essential oils. Adds a pure, earthy base to your culinary creations.",
            highlights: ["Earthy Flavor", "Culinary Staple", "Essential Oils Preserved", "Clean Solar Process"],
            specs: { "Form": "Powder", "Quantity": "200g", "Shelf Life": "6 Months", "Quality": "Premium" },
            reviews: [
                { user: "Dr. Bharathi", comment: "Very clean and flavorful. Excellent quality." }
            ]
        },
        "sorrel-powder": {
            benefits: "Natural blood builder, helps in managing hypertension, and detoxifies the liver.",
            idealFor: "Women for iron health and those with liver-related concerns.",
            advantages: "Locks in the natural organic acids that give Sorrel its tangy medicinal power.",
            prep: "Can be used to make instant Gongura chutney or added to dal.",
            dosage: "1 teaspoon daily with hot rice and a drop of ghee.",
            tasteTip: "Naturally very tangy (sour). Goes best with a bit of salt and chili powder.",
            description: "Nutrient-dense Sorrel leaves are solar-dried to retain their natural high Vitamin C and acid profile. Known for its unique tart flavor and blood-building properties.",
            highlights: ["High Vitamin C", "Tart Flavor", "Blood Health", "Nutrient Dense"],
            specs: { "Form": "Powder", "Quantity": "100g", "Shelf Life": "6 Months", "Acid Profile": "Natural Tart" },
            reviews: [
                { user: "Ms. Geetha", comment: "Great for making traditional Gongura recipes easily." }
            ]
        },
        "amla-powder": {
            benefits: "Rejuvenates eyes, hair, and skin. Highest natural source of Vitamin C.",
            idealFor: "Anyone looking for anti-aging and immune support.",
            advantages: "Cold-solar drying prevents the destruction of Vitamin C by heat.",
            prep: "Mix with warm water and honey, or use as a hair mask with curd.",
            dosage: "1 teaspoon daily in the morning.",
            tasteTip: "It has a sharp sour and bitter taste. We strongly recommend adding 1 teaspoon of honey.",
            description: "Amla (Indian Gooseberry) is the ultimate source of Vitamin C. Our solar-drying process is gentle enough to prevent the breakdown of vitamins, ensuring maximum potency for hair and skin health.",
            highlights: ["Vitamin C Powerhouse", "Hair & Skin Health", "Maximum Potency", "Ayurvedic Classic"],
            specs: { "Form": "Powder", "Quantity": "150g", "Shelf Life": "12 Months", "Purity": "100% Amla" },
            reviews: [
                { user: "Mrs. Vani", comment: "My hair has improved significantly. Very pure amla powder." }
            ]
        },
        "spinach-leaves": {
            benefits: "Improves bone health, provides natural magnesium for sleep, and high in iron.",
            idealFor: "Expectant mothers, athletes, and growing children.",
            advantages: "Fresh whole leaves are captured at their peak nutritional state via solar extraction.",
            prep: "Add to boiling water for 2 mins or crush into your soup or dal recipes.",
            dosage: "One small handful (10g) daily as part of your meal.",
            tasteTip: "Mild and pleasant. Can be added to anything without changing the taste.",
            description: "Premium Spinach leaves are captured efficiently through solar extraction. High in iron, magnesium, and essential vitamins, these leaves are preserved in their most bioavailable form.",
            highlights: ["Iron Rich", "Bioavailable Nutrient", "Solar Extraction", "Energy Booster"],
            specs: { "Form": "Whole Leaves", "Quantity": "50g", "Shelf Life": "4 Months", "Vitamins": "K, A, B2" },
            reviews: [
                { user: "Prof. Manohar", comment: "Great quality leaves. Use them in my soups every day." }
            ]
        },
        "tomato-powder": {
            benefits: "Protects against UV damage, supports heart health, and rich in potassium.",
            idealFor: "Working professionals and health-conscious cooks.",
            advantages: "The lycopene (red pigment) is 3x more concentrated than fresh tomatoes.",
            prep: "Mix with hot water for instant soup or add to your gravy base.",
            dosage: "2-3 teaspoons daily.",
            tasteTip: "Intense tomato flavor. Add a pinch of pepper and salt for a perfect snack soup.",
            description: "Vibrant red solar-dried tomatoes ground into a fine powder. Captures the deep flavor and lycopene of fresh tomatoes, making it a perfect culinary and health additive.",
            highlights: ["Lycopene Rich", "Deep Flavor", "No Added Color", "Culinary Aid"],
            specs: { "Form": "Powder", "Quantity": "150g", "Shelf Life": "6 Months", "Color": "Natural Red" },
            reviews: [
                { user: "Student Cafe", comment: "We use this for our instant soup base. The faculty loves it." }
            ]
        },
        "drumstick-powder": {
            benefits: "Controls joint pain, improves bone density, and rich in plant-based protein.",
            idealFor: "Elderly people and those with joint-related issues.",
            advantages: "Zero dust or contamination—processed in clean solar chambers.",
            prep: "Mix with warm water, milk, or add to your soup/rasam.",
            dosage: "1 teaspoon twice daily.",
            tasteTip: "Has a mild leafy taste. Honey or a little sugar can be added if taken with water.",
            description: "A renowned superfood (Moringa Drumstick) naturally dehydrated to maintain its unparalleled nutritional density. Packed with amino acids and antioxidants for total body wellness.",
            highlights: ["Superfood Status", "Amino Acid Rich", "Total Wellness", "Controlled Solar Drying"],
            specs: { "Form": "Powder", "Quantity": "200g", "Shelf Life": "9 Months", "Purity": "Gold Standard" },
            reviews: [
                { user: "Dr. Kiran", comment: "The nutritional profile of this is amazing. Very well processed." }
            ]
        },
        "fenugreek-leaves": {
            benefits: "Excellent for balancing blood sugar, improves digestion, and supports kidney health.",
            idealFor: "Diabetic patients and those with digestion issues.",
            advantages: "The medicinal bitters are perfectly preserved by avoiding artificial drying.",
            prep: "Soak in water or crush and add to your roti dough or curries.",
            dosage: "1 tablespoon daily.",
            tasteTip: "It is naturally bitter-sweet. Adding a bit of salt or taking it with roti balances the taste.",
            description: "Classic Menthi (Fenugreek) leaves prepared under the sun. Known for their distinct bitter-sweet flavor and exceptional health balancing properties, especially for glucose levels.",
            highlights: ["Glucose Balancing", "Herbal Staple", "Bitter-Sweet Aroma", "Sun Prepared"],
            specs: { "Form": "Dried Leaves", "Quantity": "50g", "Shelf Life": "6 Months", "Benefit": "Blood Sugar Support" },
            reviews: [
                { user: "Prof. Gupta", comment: "Perfect for Methi Parathas. Very clean and aromatic." }
            ]
        }
    };

    // Open Modal Function
    productCards.forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't open modal if clicking buttons directly
            if (e.target.classList.contains('add-to-cart') || e.target.classList.contains('buy-now')) return;

            const productId = card.getAttribute('data-product-id');
            const data = productDetails[productId];

            if (!data) return;

            // Reset selections to default (1 pack, 100g)
            packOptions.forEach(b => b.classList.remove('active'));
            packOptions[0].classList.add('active');
            packLabel.innerText = "1";

            qtyOptions.forEach(b => b.classList.remove('active'));
            qtyOptions[0].classList.add('active');
            qtyLabel.innerText = "100 g";

            // Extract numeric base price for calculations
            const rawPrice = card.querySelector('.price').innerText.replace('₹', '');
            basePriceValue = parseInt(rawPrice);

            // Fill Modal Data
            productModal.setAttribute('data-active-product-id', productId);
            document.getElementById('modal-img').src = card.querySelector('img').src;
            document.getElementById('modal-tag').innerText = card.querySelector('.tag').innerText;
            document.getElementById('modal-title').innerText = card.querySelector('h3').innerText;
            document.getElementById('modal-price').innerText = card.querySelector('.price').innerText;
            document.getElementById('modal-description-text').innerText = data.description;

            // Fill stock status in modal
            const stockStatusEl = document.getElementById('modal-stock-status') || (() => {
                const el = document.createElement('div');
                el.id = 'modal-stock-status';
                el.style.fontSize = '0.95rem';
                el.style.fontWeight = '600';
                el.style.marginTop = '10px';
                el.style.marginBottom = '15px';
                const priceSec = document.querySelector('.modal-price-section');
                if (priceSec) priceSec.parentNode.insertBefore(el, priceSec.nextSibling);
                return el;
            })();

            const itemStockInfo = inventoryData[productId];
            const modalAddBtn = productModal.querySelector('.add-to-cart');
            const modalBuyBtn = productModal.querySelector('.buy-now');

            if (itemStockInfo) {
                const { stock, threshold } = itemStockInfo;
                if (stock === 0) {
                    stockStatusEl.innerHTML = `<span style="color: #e74c3c;">❌ Out of Stock</span>`;
                    if (modalAddBtn) { modalAddBtn.disabled = true; modalAddBtn.innerText = 'Out of Stock'; }
                    if (modalBuyBtn) { modalBuyBtn.disabled = true; modalBuyBtn.innerText = 'Out of Stock'; }
                } else if (stock <= threshold) {
                    stockStatusEl.innerHTML = `<span style="color: #e67e22;">⚠️ Only ${stock} left in stock!</span>`;
                    if (modalAddBtn) { modalAddBtn.disabled = false; modalAddBtn.innerText = 'Add to Cart'; }
                    if (modalBuyBtn) { modalBuyBtn.disabled = false; modalBuyBtn.innerText = 'Buy Now'; }
                } else {
                    stockStatusEl.innerHTML = `<span style="color: #2D5A27;">✅ In Stock</span>`;
                    if (modalAddBtn) { modalAddBtn.disabled = false; modalAddBtn.innerText = 'Add to Cart'; }
                    if (modalBuyBtn) { modalBuyBtn.disabled = false; modalBuyBtn.innerText = 'Buy Now'; }
                }

                // Update pack selection buttons based on stock
                const currentStock = stock;
                let firstEnabledPackBtn = null;
                let currentActivePackEnabled = false;

                packOptions.forEach(btn => {
                    const btnPackValue = parseInt(btn.getAttribute('data-pack')) || 1;
                    if (btnPackValue > currentStock) {
                        btn.disabled = true;
                        btn.style.opacity = '0.3';
                        btn.style.pointerEvents = 'none';
                        btn.classList.remove('active');
                    } else {
                        btn.disabled = false;
                        btn.style.opacity = '1';
                        btn.style.pointerEvents = 'auto';
                        if (!firstEnabledPackBtn) firstEnabledPackBtn = btn;
                        if (btn.classList.contains('active')) {
                            currentActivePackEnabled = true;
                        }
                    }
                });

                // If currently active pack button is disabled (or was cleared because it exceeded stock), select the highest available pack option
                if (!currentActivePackEnabled && firstEnabledPackBtn) {
                    let highestEnabled = firstEnabledPackBtn;
                    packOptions.forEach(btn => {
                        const btnPackValue = parseInt(btn.getAttribute('data-pack')) || 1;
                        if (btnPackValue <= currentStock && !btn.disabled) {
                            highestEnabled = btn;
                        }
                    });
                    
                    packOptions.forEach(b => b.classList.remove('active'));
                    highestEnabled.classList.add('active');
                    packLabel.innerText = highestEnabled.getAttribute('data-pack');
                } else if (!firstEnabledPackBtn) {
                    // Stock is 0
                    packOptions.forEach(b => b.classList.remove('active'));
                    packLabel.innerText = "0";
                }
            } else {
                stockStatusEl.innerHTML = '';
            }

            // Recalculate price in case selection changed
            updateModalPrice();

            // New Wellness Data
            document.getElementById('modal-benefits-text').innerText = data.benefits;
            document.getElementById('modal-users-text').innerText = data.idealFor;
            document.getElementById('modal-advantages-text').innerText = data.advantages;

            // New Usage Data
            document.getElementById('modal-prep-text').innerText = data.prep;
            document.getElementById('modal-dosage-text').innerText = data.dosage;
            document.getElementById('modal-taste-text').innerText = data.tasteTip;

            // Highlights
            const highlightsList = document.getElementById('modal-highlights-list');
            highlightsList.innerHTML = data.highlights.map(h => `<li>${h}</li>`).join('');

            // Specs
            const specsGrid = document.getElementById('modal-specs-grid');
            specsGrid.innerHTML = Object.entries(data.specs).map(([label, value]) => `
                <div class="spec-item">
                    <span class="spec-label">${label}</span>
                    <span class="spec-value">${value}</span>
                </div>
            `).join('');

            // Reviews
            const reviewsList = document.getElementById('modal-reviews-list');
            reviewsList.innerHTML = data.reviews.map(r => `
                <div class="review-card">
                    <strong>👤 ${r.user}</strong>
                    <p>${r.comment}</p>
                </div>
            `).join('');

            productModal.classList.add('active');
            document.body.style.overflow = 'hidden'; // Stop scrolling
        });
    });

    // Close Modal
    function closeModal() {
        productModal.classList.remove('active');
        document.body.style.overflow = 'auto'; // Restore scrolling
    }

    modalClose.addEventListener('click', closeModal);
    productModal.addEventListener('click', (e) => {
        if (e.target === productModal) closeModal();
    });

    // --- Pack and Quantity Selection Logic ---
    packOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active class
            packOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update label
            packLabel.innerText = btn.getAttribute('data-pack');
            updateModalPrice();
        });
    });

    qtyOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active class
            qtyOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update label
            qtyLabel.innerText = btn.getAttribute('data-qty') + ' g';
            updateModalPrice();
        });
    });

    // --- Authentication & OTP Logic ---
    let currentOTP = "";
    let timerInterval;
    const authModal = document.getElementById('auth-modal');
    const openAuthBtn = document.getElementById('open-auth');
    const closeAuthX = document.getElementById('close-auth-x');
    
    const loginForm = document.getElementById('login-form');
    const otpScreen = document.getElementById('otp-screen');
    const otpDigits = document.querySelectorAll('.otp-digit');
    const verifyOtpBtn = document.getElementById('verify-otp-btn');
    const backToLoginBtn = document.getElementById('back-to-login');
    const timerSec = document.getElementById('timer-sec');

    const profileSidebar = document.getElementById('profile-sidebar');
    const toggleProfileBtn = document.getElementById('toggle-profile');
    const closeProfileBtn = document.getElementById('close-profile');
    const logoutBtn = document.getElementById('logout-btn');
    const userProfileNav = document.getElementById('user-profile-nav');

    // Toggle Auth Modal
    openAuthBtn.addEventListener('click', () => authModal.classList.add('active'));
    closeAuthX.addEventListener('click', () => authModal.classList.remove('active'));

    // Handle Login (Request OTP from Backend)
    const handleLoginSubmit = async (e) => {
        if(e) e.preventDefault();
        console.log("Attempting to get OTP..."); 
        
        const mobileInput = document.getElementById('login-mobile');
        const mobile = mobileInput.value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;
        
        if(!mobile || mobile.length < 10) {
            alert("Please enter a valid 10-digit mobile number.");
            return;
        }

        // Show Loading State
        submitBtn.innerText = "Connecting...";
        submitBtn.style.opacity = "0.7";
        submitBtn.disabled = true;
        
        try {
            // Set a timeout for the fetch call
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 sec timeout

            const res = await fetch('http://localhost:3000/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mobile }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            const data = await res.json();
            
            if (data.success) {
                currentOTP = data.debugOtp; 
                
                // ENABLED ON-SCREEN NOTIFICATION AS REQUESTED
                showMockSMS(currentOTP, mobile);
                
                // Transition UI
                loginForm.classList.add('hidden');
                otpScreen.classList.remove('hidden');
                
                startOtpTimer();
                setTimeout(() => {
                    const firstDigit = document.querySelector('.otp-digit');
                    if (firstDigit) firstDigit.focus();
                }, 300);
            }
        } catch (err) {
            console.warn("Server connection failed, using Simulation Mode.");
            // SILENT FALLBACK: If server fails, show the screen anyway
            currentOTP = generateRandomOTP();
            showMockSMS(currentOTP, mobile); // ENABLED ON-SCREEN
            loginForm.classList.add('hidden');
            otpScreen.classList.remove('hidden');
            startOtpTimer();
            setTimeout(() => {
                const firstDigit = document.querySelector('.otp-digit');
                if (firstDigit) firstDigit.focus();
            }, 300);
        } finally {
            submitBtn.innerText = originalText;
            submitBtn.style.opacity = "1";
            submitBtn.disabled = false;
        }
    };

    loginForm.addEventListener('submit', handleLoginSubmit);

    function generateRandomOTP() {
        let otp = "";
        const isSequential = (str) => {
            const seq = "01234567890123456789";
            const revSeq = "98765432109876543210";
            return seq.includes(str) || revSeq.includes(str) || /^(\d)\1+$/.test(str);
        };

        do {
            otp = Math.floor(100000 + Math.random() * 900000).toString();
        } while (isSequential(otp));
        
        return otp;
    }

    function showMockSMS(otp, mobile) {
        // Create mock notification element
        const notification = document.createElement('div');
        notification.className = 'mock-sms-notification';
        notification.innerHTML = `
            <div class="sms-icon">💬</div>
            <div class="sms-content">
                <strong>Messages</strong>
                <p>SUN FRESH: ${otp} is your OTP for login. Do not share it with anyone.</p>
            </div>
        `;
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 500);
        }, 5000);
    }

    // Handle OTP Input Auto-focus
    otpDigits.forEach((digit, index) => {
        digit.addEventListener('keyup', (e) => {
            if (e.key >= 0 && e.key <= 9) {
                if (index < otpDigits.length - 1) otpDigits[index + 1].focus();
            } else if (e.key === 'Backspace') {
                if (index > 0) otpDigits[index - 1].focus();
            }
        });
    });

    // Verify OTP via Backend
    verifyOtpBtn.addEventListener('click', async () => {
        let enteredOTP = "";
        const digits = document.querySelectorAll('.otp-digit');
        digits.forEach(d => enteredOTP += d.value);
        const mobile = document.getElementById('login-mobile').value;

        try {
            const res = await fetch('http://localhost:3000/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mobile, otp: enteredOTP })
            });
            const data = await res.json();

            if (data.success || (enteredOTP === currentOTP && currentOTP !== "")) {
                const isAdmin = (mobile.replace(/\D/g, '').slice(-10) === "9542137161");
                const emailInput = document.getElementById('login-email');
                const email = (emailInput && emailInput.value) ? emailInput.value : "Not Provided";

                const userData = {
                    name: isAdmin ? "Sun Fresh Admin" : "Customer " + mobile.substring(6),
                    email: email,
                    mobile: mobile,
                    initials: isAdmin ? "AD" : mobile.substring(8),
                    isAdmin: isAdmin,
                    orders: []
                };
                localStorage.setItem('sunfresh_user', JSON.stringify(userData));
                if (isAdmin) localStorage.setItem('admin_token', 'ADMIN-SESSION-' + Date.now());
                
                updateLoginState();
                authModal.classList.remove('active');
                resetAuthUI();
            } else {
                alert("Invalid OTP! Please try again.");
                digits.forEach(d => d.value = "");
                digits[0].focus();
            }
        } catch (err) {
            console.error("VERIFY ERROR:", err);
            // FALLBACK logic for offline/server error testing
            if (enteredOTP === currentOTP && currentOTP !== "") {
                const isAdmin = (mobile.replace(/\D/g, '').slice(-10) === "9542137161");
                const emailInput = document.getElementById('login-email');
                const email = (emailInput && emailInput.value) ? emailInput.value : "Not Provided";
                
                const userData = {
                    name: isAdmin ? "Sun Fresh Admin" : "Customer " + mobile.substring(6),
                    email: email,
                    mobile: mobile,
                    initials: isAdmin ? "AD" : mobile.substring(8),
                    isAdmin: isAdmin,
                    orders: []
                };
                localStorage.setItem('sunfresh_user', JSON.stringify(userData));
                if (isAdmin) localStorage.setItem('admin_token', 'ADMIN-SESSION-' + Date.now());

                updateLoginState();
                authModal.classList.remove('active');
                resetAuthUI();
            } else {
                alert("Verification failed. Check your connection.");
            }
        }
    });

    function startOtpTimer() {
        let sec = 30;
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            sec--;
            timerSec.innerText = sec;
            if (sec <= 0) clearInterval(timerInterval);
        }, 1000);
    }

    function resetAuthUI() {
        loginForm.classList.remove('hidden');
        otpScreen.classList.add('hidden');
        otpDigits.forEach(d => d.value = "");
    }

    backToLoginBtn.addEventListener('click', resetAuthUI);

    function updateLoginState() {
        const user = JSON.parse(localStorage.getItem('sunfresh_user'));
        const adminLinkSection = document.getElementById('admin-link-section');

        if (user) {
            openAuthBtn.classList.add('hidden');
            userProfileNav.classList.remove('hidden');
            document.querySelector('.user-initials').innerText = user.initials;
            
            document.getElementById('profile-name-display').innerText = user.name;
            document.getElementById('profile-avatar-header').innerText = user.initials;

            // Show Admin Dashboard link if user is admin
            if (user.isAdmin) {
                if (adminLinkSection) adminLinkSection.classList.remove('hidden');
            } else {
                if (adminLinkSection) adminLinkSection.classList.add('hidden');
            }
        } else {
            openAuthBtn.classList.remove('hidden');
            userProfileNav.classList.add('hidden');
            if (adminLinkSection) adminLinkSection.classList.add('hidden');
        }
    }

    // Profile Sidebar Toggles
    toggleProfileBtn.addEventListener('click', () => profileSidebar.classList.add('active'));
    closeProfileBtn.addEventListener('click', () => profileSidebar.classList.remove('active'));
    
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('sunfresh_user');
        updateLoginState();
        profileSidebar.classList.remove('active');
    });

    updateLoginState();

    [authModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

    // Check if running from file system
    if (window.location.protocol === 'file:') {
        console.warn("WARNING: Server required.");
        alert("Attention: Please run 'node server.js' and use http://localhost:3000. Features will not work if you open the .html file directly.");
    }
});
