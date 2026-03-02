<h1 align="center">
  <img src="icon128.png" alt="LinkedIn Games Solver Logo" width="128">
  <br>
  LinkedIn Games Solver
</h1>

<p align="center">
  <strong>A powerful Chrome Extension to automatically solve daily LinkedIn games!</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/JavaScript-ES6+-yellow?logo=javascript&logoColor=white" alt="JavaScript">
  <img src="https://img.shields.io/badge/LinkedIn-Games-0077B5?logo=linkedin&logoColor=white" alt="LinkedIn Games">
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="License: MIT">
</p>

## ✨ Features

- 👑 **Queens Solver**: Instantly get help or fully solve the Queens puzzle.
- ☀️ **Tango Solver**: Easily solve the Tango puzzle with automated steps or a full solution.
- 🔢 **Mini Sudoku Solver**: Breeze through the Mini Sudoku game with one click.
- 🚀 **Zip & Pinpoint**: (In Progress / Partial Support) Future-ready UI for solving other upcoming or current LinkedIn games.

## 📸 How It Works

LinkedIn Games Solver injects an intuitive menu via a Chrome extension popup when you navigate to LinkedIn's game pages. It automatically detects which game you are currently playing and provides two powerful options:

1.  **Help with One Move:** Provides a hint or a single guaranteed correct step to help you when you're stuck without spoiling the whole game.
2.  **Solve the puzzle:** Automatically computes the final solution and applies it instantly!

## 🛠️ Installation

Because this extension is not yet published to the Chrome Web Store, you can install it manually by following these steps:

1.  **Download or Clone this Repository**

    ```bash
    git clone https://github.com/Ashok-think/linkedin-games-solver.git
    ```

    _(Alternatively, you can download the project as a ZIP and extract it)._

2.  **Open Chrome Extensions Page**
    - Open your Google Chrome browser.
    - Navigate to `chrome://extensions/` in your address bar.

3.  **Enable Developer Mode**
    - In the top right corner of the Extensions page, toggle the **Developer mode** switch to **ON**.

4.  **Load the Extension**
    - Click on the **Load unpacked** button (which appears after enabling Developer mode).
    - Select the folder containing this project containing the `manifest.json`.

5.  **Pin the Extension (Optional but Recommended)**
    - Click the jigsaw puzzle icon in your Chrome toolbar.
    - Click the pin icon next to "LinkedIn Solver" to keep it visible.

## 🎮 Usage

1.  Go to the [LinkedIn Games](https://www.linkedin.com/games/) hub and select a game (e.g., Queens, Tango, Mini Sudoku).
2.  Once the game has fully loaded, click the **LinkedIn Solver** extension icon in your Chrome toolbar.
3.  The extension will detect the game you are playing.
4.  Choose either **Help with One Move** or **Solve the puzzle**.
5.  Watch the magic happen!

## 🧩 Supported Games Architecture

The extension is structured intelligently to support multiple games dynamically:

- **`popup.html` & `popup.js`**: Handle the user interface, buttons, and sending commands to the content scripts.
- **`src/content/detectGame.js`**: Automatically figures out which game is currently active on the page.
- **`src/content/games/`**: Contains the specific solving algorithms for each game (Queens, Tango, Sudoku).

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<p align="center">
  <i>Developed with ❤️ for puzzle enthusiasts. Use responsibly and have fun!</i>
</p>
