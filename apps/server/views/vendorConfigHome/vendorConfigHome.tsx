import React from 'react';

const VendorConfigHome = (
  <div
    className="vendor-config-container"
    style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      height: '100vh',
      overflowX: 'hidden',
      background: 'linear-gradient(to right, rgb(248,30,30), rgb(255,189,77))',
    }}
  >
    {/* Gradient Background */}
    <div
      className="gradient-background"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
      }}
    ></div>

    {/* Logo */}
    <div
      className="logo-container"
      style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <img
        src="/apps/server/assets/icon.png" // Insert the image source inline
        alt="Logo"
        className="logo-image"
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      />
    </div>

    {/* Scrollable Content */}
    <div
      className="scrollable-content"
      style={{
        flex: 2,
        padding: '20px',
        overflowY: 'auto',
        marginRight:'50px'
      }}
    >
      {/* Section 1 */}
      <div className="config-section" style={{ marginBottom: '20px'}}>
        <label
          className="config-label"
          style={{ fontWeight: 'bold', color: 'white', marginBottom: '5px' }}
        >
          API KEY
        </label>
        <input
          type="text"
          className="text-field"
          placeholder="Enter API KEY"
          style={{
            width: '100%',
            padding: '10px',
            border: 'none',
            borderRadius: '5px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
          }}
        />
      </div>

      {/* Section 2 */}
      <div className="config-section" style={{ marginBottom: '20px' }}>
        <label
          className="config-label"
          style={{ fontWeight: 'bold', color: 'white', marginBottom: '5px' }}
        >
          Another Label
        </label>
        <input
          type="text"
          className="text-field"
          placeholder="Another Text Field"
          style={{
            width: '100%',
            padding: '10px',
            border: 'none',
            borderRadius: '5px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
          }}
        />
      </div>

      {/* Add more sections as needed */}
    </div>
  </div>
);

export default VendorConfigHome;
