// ===================================
// HOTEL & RESTAURANT MANAGEMENT SYSTEM
// Website JavaScript
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    
    // ==================== NAVBAR SCROLL EFFECT ====================
    const navbar = document.getElementById('navbar');
    let lastScroll = 0;
    
    window.addEventListener('scroll', function() {
        const currentScroll = window.pageYOffset;
        
        // Add scrolled class for styling
        if (currentScroll > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        lastScroll = currentScroll;
    });
    
    // ==================== MOBILE MENU TOGGLE ====================
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            
            // Animate hamburger icon
            const spans = this.querySelectorAll('span');
            if (navMenu.classList.contains('active')) {
                spans[0].style.transform = 'rotate(45deg) translateY(10px)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'rotate(-45deg) translateY(-10px)';
            } else {
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        });
    }
    
    // Close mobile menu when clicking on a link
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                navMenu.classList.remove('active');
                const spans = mobileMenuToggle.querySelectorAll('span');
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        });
    });
    
    // ==================== SMOOTH SCROLLING ====================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Skip empty hash or just # links
            if (href === '#' || href === '') return;
            
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const offsetTop = target.offsetTop - 80; // Account for fixed navbar
                
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // ==================== ACTIVE NAVIGATION LINK ====================
    const sections = document.querySelectorAll('section[id]');
    
    function updateActiveNav() {
        const scrollPosition = window.pageYOffset + 100;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }
    
    window.addEventListener('scroll', updateActiveNav);
    
    // ==================== ANIMATE ON SCROLL (AOS) INITIALIZATION ====================
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            easing: 'ease-in-out',
            once: true,
            offset: 100,
            delay: 100
        });
    }
    
    // ==================== CONTACT FORM SUBMISSION ====================
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                business: document.getElementById('business').value,
                message: document.getElementById('message').value
            };
            
            // Show loading state
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;
            
            // Simulate form submission (replace with actual API call)
            setTimeout(() => {
                // Show success message
                showNotification('Thank you! We\'ll get back to you soon.', 'success');
                
                // Reset form
                contactForm.reset();
                
                // Reset button
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }, 1500);
            
            // In production, replace the setTimeout with actual API call:
            /*
            fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            })
            .then(response => response.json())
            .then(data => {
                showNotification('Thank you! We\'ll get back to you soon.', 'success');
                contactForm.reset();
            })
            .catch(error => {
                showNotification('Oops! Something went wrong. Please try again.', 'error');
            })
            .finally(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            });
            */
        });
    }
    
    // ==================== NOTIFICATION SYSTEM ====================
    function showNotification(message, type = 'success') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${type === 'success' ? '✓' : '✕'}</span>
                <span class="notification-message">${message}</span>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 24px;
            background: ${type === 'success' ? '#10B981' : '#EF4444'};
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            display: flex;
            align-items: center;
            gap: 12px;
            font-weight: 600;
            font-size: 14px;
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 4000);
    }
    
    // Add notification animations to document
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
        
        .notification-content {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .notification-icon {
            width: 24px;
            height: 24px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
        }
    `;
    document.head.appendChild(style);
    
    // ==================== COUNTER ANIMATION ====================
    function animateCounter(element, target, duration = 2000) {
        let startTime = null;
        const startValue = 0;
        
        function animate(currentTime) {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            
            const currentValue = Math.floor(progress * target);
            element.textContent = currentValue.toLocaleString();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Add + or % suffix if needed
                if (element.dataset.suffix) {
                    element.textContent = currentValue + element.dataset.suffix;
                }
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    // Animate stats when they come into view
    const statObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const statElement = entry.target;
                const targetValue = parseInt(statElement.textContent.replace(/[^0-9]/g, ''));
                
                // Store suffix if exists
                if (statElement.textContent.includes('+')) {
                    statElement.dataset.suffix = '+';
                } else if (statElement.textContent.includes('%')) {
                    statElement.dataset.suffix = '%';
                }
                
                animateCounter(statElement, targetValue);
                statObserver.unobserve(statElement);
            }
        });
    }, { threshold: 0.5 });
    
    document.querySelectorAll('.stat-item h3').forEach(stat => {
        statObserver.observe(stat);
    });
    
    // ==================== PARALLAX EFFECT ====================
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const parallaxElements = document.querySelectorAll('.animated-shapes');
        
        parallaxElements.forEach(element => {
            const speed = 0.5;
            element.style.transform = `translateY(${scrolled * speed}px)`;
        });
    });
    
    // ==================== LAZY LOADING IMAGES ====================
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }
                    observer.unobserve(img);
                }
            });
        });
        
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
    
    // ==================== PRICING TOGGLE (if needed) ====================
    const pricingToggle = document.getElementById('pricingToggle');
    if (pricingToggle) {
        pricingToggle.addEventListener('change', function() {
            // Toggle between monthly and yearly pricing
            const priceAmounts = document.querySelectorAll('.amount');
            priceAmounts.forEach(amount => {
                const monthlyPrice = parseInt(amount.dataset.monthly);
                const yearlyPrice = parseInt(amount.dataset.yearly);
                
                if (this.checked) {
                    amount.textContent = yearlyPrice.toLocaleString();
                } else {
                    amount.textContent = monthlyPrice.toLocaleString();
                }
            });
        });
    }
    
    // ==================== BACK TO TOP BUTTON ====================
    const backToTop = document.createElement('button');
    backToTop.innerHTML = '↑';
    backToTop.className = 'back-to-top';
    backToTop.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #3A7D7C, #2F6665);
        color: white;
        border: none;
        border-radius: 50%;
        font-size: 24px;
        cursor: pointer;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
        z-index: 999;
        box-shadow: 0 4px 12px rgba(58, 125, 124, 0.3);
    `;
    
    document.body.appendChild(backToTop);
    
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            backToTop.style.opacity = '1';
            backToTop.style.visibility = 'visible';
        } else {
            backToTop.style.opacity = '0';
            backToTop.style.visibility = 'hidden';
        }
    });
    
    backToTop.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    backToTop.addEventListener('mouseenter', function() {
        this.style.transform = 'scale(1.1)';
    });
    
    backToTop.addEventListener('mouseleave', function() {
        this.style.transform = 'scale(1)';
    });
    
    // ==================== FEATURE CARD TILT EFFECT ====================
    const featureCards = document.querySelectorAll('.feature-card, .product-card');
    
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transition = 'transform 0.1s ease';
        });
        
        card.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;
            
            this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transition = 'transform 0.3s ease';
            this.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
        });
    });
    
    // ==================== CONSOLE BRANDING ====================
    console.log('%c🏨 Hotel & Restaurant Management System', 'font-size: 20px; font-weight: bold; color: #3A7D7C;');
    console.log('%cBuilt with ❤️ for Modern Hospitality', 'font-size: 12px; color: #64748B;');
    console.log('%cVisit: hotelrestaurantsuite.com', 'font-size: 12px; color: #3A7D7C;');
    
    // ==================== PERFORMANCE MONITORING ====================
    window.addEventListener('load', function() {
        const loadTime = window.performance.timing.domContentLoadedEventEnd - window.performance.timing.navigationStart;
        console.log(`⚡ Page loaded in ${loadTime}ms`);
    });
    
});

// ==================== UTILITY FUNCTIONS ====================

// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function for scroll events
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
