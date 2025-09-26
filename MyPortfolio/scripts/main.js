'use strict';

// 现代化个人网站交互功能

class PersonalWebsite {
    constructor() {
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupScrollEffects();
        this.setupAnimations();
        this.setupContactForm();
    }

    // 导航功能
    setupNavigation() {
        // 平滑滚动
        const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });

        // 导航栏滚动效果
        window.addEventListener('scroll', () => {
            const header = document.querySelector('.header');
            if (window.scrollY > 100) {
                header.style.background = 'rgba(255, 255, 255, 0.98)';
            } else {
                header.style.background = 'rgba(255, 255, 255, 0.95)';
            }
        });
    }

    // 滚动效果
    setupScrollEffects() {
        // Intersection Observer for animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        // 观察需要动画的元素
        const animatedElements = document.querySelectorAll('.skill-item, .project-card, .timeline-item');
        animatedElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(el);
        });
    }

    // 动画效果
    setupAnimations() {
        // 打字机效果
        const heroTitle = document.querySelector('.hero-title');
        if (heroTitle) {
            this.typewriterEffect(heroTitle);
        }

        // 技能条动画
        this.animateSkillBars();
    }

    // 打字机效果
    typewriterEffect(element) {
        const originalText = element.textContent;
        const highlightSpan = element.querySelector('.highlight');
        const highlightText = highlightSpan ? highlightSpan.textContent : '';
        
        element.textContent = '';
        let i = 0;
        
        const typeTimer = setInterval(() => {
            if (i < originalText.length) {
                if (originalText.slice(i).startsWith(highlightText) && highlightText) {
                    element.innerHTML += `<span class="highlight">${highlightText}</span>`;
                    i += highlightText.length;
                } else {
                    element.textContent += originalText[i];
                    i++;
                }
            } else {
                clearInterval(typeTimer);
            }
        }, 100);
    }

    // 技能条动画
    animateSkillBars() {
        const skillItems = document.querySelectorAll('.skill-item');
        skillItems.forEach((item, index) => {
            setTimeout(() => {
                item.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    item.style.transform = 'scale(1)';
                }, 200);
            }, index * 200);
        });
    }

    // 联系表单处理
    setupContactForm() {
        // 如果有联系表单的话
        const contactSection = document.querySelector('#contact');
        if (contactSection) {
            const contactItems = contactSection.querySelectorAll('.contact-item');
            contactItems.forEach(item => {
                item.addEventListener('click', () => {
                    const text = item.querySelector('span').textContent;
                    if (text.includes('@')) {
                        // 邮箱
                        window.location.href = `mailto:${text}`;
                    } else if (text.includes('github')) {
                        // GitHub
                        window.open(`https://${text}`, '_blank');
                    } else if (text.includes('linkedin')) {
                        // LinkedIn
                        window.open(`https://${text}`, '_blank');
                    }
                });
            });
        }
    }

    // 添加粒子效果背景
    addParticleBackground() {
        const hero = document.querySelector('.hero');
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '-1';
        hero.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        canvas.width = hero.offsetWidth;
        canvas.height = hero.offsetHeight;

        const particles = [];
        const particleCount = 50;

        // 创建粒子
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                radius: Math.random() * 2 + 1
            });
        }

        // 动画循环
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            particles.forEach(particle => {
                particle.x += particle.vx;
                particle.y += particle.vy;

                if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
                if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(37, 99, 235, 0.1)';
                ctx.fill();
            });

            requestAnimationFrame(animate);
        };

        animate();
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new PersonalWebsite();
});

// 添加一些实用的全局函数
window.utils = {
    // 节流函数
    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        return function (...args) {
            const currentTime = Date.now();
            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    },

    // 防抖函数
    debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
};