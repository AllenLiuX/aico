import React, { useEffect, useState } from 'react';


// Mobile Wrapper Component - You can put this in a separate file
const MobileResponsiveWrapper = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    // Check if screen is mobile size
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // Initial check
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);
  
  return (
    <div className={`content-wrapper ${isMobile ? 'mobile-view' : ''}`}>
      {children}
    </div>
  );
};

// const MobileResponsiveWrapper = ({ children }) => {
//   const [isMobile, setIsMobile] = useState(false);
  
//   useEffect(() => {
//     // Check if screen is mobile size
//     const checkMobile = () => {
//       setIsMobile(window.innerWidth <= 768);
//     };
    
//     // Initial check
//     checkMobile();
    
//     // Add resize listener
//     window.addEventListener('resize', checkMobile);
    
//     // Apply additional styles for mobile
//     if (window.innerWidth <= 768) {
//       document.querySelector('body').classList.add('mobile-view');
      
//       // Fix the player container width
//       const containers = document.querySelectorAll(
//         '.player-container, .playlist-section, .moderation-section, .pagination-controls'
//       );
      
//       containers.forEach(container => {
//         container.style.width = '100%';
//         container.style.maxWidth = '100%';
//         container.style.boxSizing = 'border-box';
//         container.style.padding = '16px 12px';
//       });
      
//       // Fix the track-details overflow
//       const trackDetails = document.querySelectorAll('.track-details');
//       trackDetails.forEach(detail => {
//         detail.style.overflow = 'hidden';
//         detail.style.textOverflow = 'ellipsis';
//       });
//     }
    
//     // Clean up
//     return () => {
//       window.removeEventListener('resize', checkMobile);
//       document.querySelector('body').classList.remove('mobile-view');
//     };
//   }, []);
  
//   return (
//     <div className={`content-wrapper ${isMobile ? 'mobile-view' : ''}`}>
//       {children}
//     </div>
//   );
// };

export default MobileResponsiveWrapper;