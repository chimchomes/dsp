import React from 'react';

export default function SplashScreen() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', color: 'white', padding: '1.5rem', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', margin: '0 0 1rem 0' }}>AppBox38</h1>
        <p style={{ fontSize: '1.125rem', color: '#9CA3AF', maxWidth: '28rem', margin: '0 auto 2rem auto', lineHeight: '1.5' }}>
          We are currently in private beta. The platform is undergoing testing and will be launching soon.
        </p>
        <div style={{ display: 'inline-block', padding: '0.5rem 1.5rem', backgroundColor: '#2563EB', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Coming Soon
        </div>
      </div>
    </div>
  );
}