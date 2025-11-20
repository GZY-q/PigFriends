document.addEventListener('DOMContentLoaded', () => {
    // 1. 鼠标移动视差效果 (Parallax)
    const shapes = document.querySelectorAll('.shape');
    const container = document.querySelector('.container');
    
    document.addEventListener('mousemove', (e) => {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        
        // 移动背景形状
        shapes.forEach((shape, index) => {
            const speed = (index + 1) * 20; // 不同形状移动速度不同
            const xOffset = (window.innerWidth / 2 - e.clientX) / speed;
            const yOffset = (window.innerHeight / 2 - e.clientY) / speed;
            
            shape.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
        });
    });
    
    // 2. 3D 倾斜效果 (Tilt Effect) for Header
    const header = document.querySelector('.header');
    const headerContent = document.querySelector('.header-content');
    
    if (header && headerContent) {
        header.addEventListener('mousemove', (e) => {
            const rect = header.getBoundingClientRect();
            const x = e.clientX - rect.left; // 鼠标在元素内的x坐标
            const y = e.clientY - rect.top;  // 鼠标在元素内的y坐标
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = ((y - centerY) / centerY) * -10; // 最大旋转角度 10deg
            const rotateY = ((x - centerX) / centerX) * 10;
            
            headerContent.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });
        
        header.addEventListener('mouseleave', () => {
            headerContent.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
        });
    }
});
