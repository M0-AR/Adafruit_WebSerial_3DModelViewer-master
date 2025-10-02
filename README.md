# Bladder AI Project - 3D Model Viewer

This project is a web-based 3D model viewer designed to visualize data from a motion sensor, likely for a medical application involving a bladder. It uses WebSerial to connect to a device and displays its orientation in a 3D space.

## For Business

### Problem Statement
In medical procedures like cystoscopy, navigating and tracking the area of examination is crucial. This project provides a real-time 3D visualization of the orientation of a sensor, which can be attached to a medical instrument. This allows for better understanding of the instrument's position and can help in creating a "map" of the examined area.

### Key Features
*   **Real-time 3D Visualization:** Displays a 3D model that rotates based on sensor data.
*   **Web-Based:** Accessible through a web browser, requiring no software installation.
*   **Sensor Data Integration:** Connects to hardware via the WebSerial API to receive orientation data.
*   **Marker Placement:** Places markers on the 3D model to indicate visited areas.

### Potential Applications
*   **Medical Training:** Simulating procedures and training medical students.
*   **Surgical Assistance:** Providing surgeons with a real-time view of their instrument's orientation.
*   **Robotics:** Visualizing the orientation of robotic arms or other components.

## For Developers

### Technology Stack
*   **Frontend:** HTML, CSS, JavaScript
*   **3D Graphics:** [three.js](https://threejs.org/)
*   **Serial Communication:** [WebSerial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
*   **3D Model Loaders:** `OBJLoader`, `STLLoader`, `VRMLLoader`

### Architecture
The application is a single-page web application.
*   `index.html`: The main entry point of the application. It sets up the HTML structure, imports necessary scripts and stylesheets.
*   `js/script.js`: The core JavaScript file that handles:
    *   **WebSerial Connection:** Managing the connection to the serial device.
    *   **Data Parsing:** Reading and parsing orientation data (Euler angles or Quaternions).
    *   **3D Scene Setup:** Initializing the `three.js` scene, camera, lighting, and controls.
    *   **Model Loading:** Loading the 3D model (`.obj` file).
    *   **Rendering Loop:** Continuously rendering the scene and updating the model's orientation.
*   `css/`: Contains stylesheets for the application, including a dark mode theme.
*   `assets/`: Contains the 3D models and material files.
*   `libs/`: Contains the `three.js` library and its associated loaders and controls.

### File Structure
```
.
├── assets/         # 3D models and materials
├── css/            # Stylesheets
├── js/
│   └── script.js   # Main application logic
├── libs/           # three.js and related libraries
├── index.html      # Main HTML file
└── README.md       # This file
```

### Setup and Running
1.  **Hardware:** You need a device that sends orientation data over a serial connection. The expected format is either:
    *   `Orientation: [yaw],[pitch],[roll]`
    *   `Quaternion: [w],[x],[y],[z]`
2.  **Browser:** Use a browser that supports the WebSerial API (e.g., Chrome 78 or later). You may need to enable the `#enable-experimental-web-platform-features` flag in `chrome://flags`.
3.  **Run:** Open the `index.html` file in your browser.
4.  **Connect:** Click the "Connect" button and select the appropriate serial port and baud rate.

## For Testers

### How to Test
1.  **Connection:**
    *   Verify that the "Connect" button is visible.
    *   Click "Connect" and ensure the browser's serial port selection dialog appears.
    *   After connecting to a device, the button should change to "Disconnect".
2.  **3D Model Visualization:**
    *   Confirm that the 3D model loads and is visible in the center of the screen.
    *   The model should rotate according to the data received from the serial device.
3.  **Controls:**
    *   **Dark Mode:** Check if the "Dark Mode" checkbox toggles the theme of the application.
    *   **Angle Type:** The "Angle Type" selector is currently hidden, but if made visible, it should switch between Euler and Quaternion calculations.
4.  **Marker Placement:**
    *   As the model rotates, markers should be placed on the model's surface to indicate the path of the sensor. Verify that these markers appear as expected.

## Roadmap
Based on the `todo.txt` file, the following improvement is planned:
*   **Improved Navigation:** Implement a feature to assist in navigating through difficult-to-reach areas of the 3D model. This could involve features like zooming, panning, or alternative camera controls that activate when the main marker is in a complex region.
