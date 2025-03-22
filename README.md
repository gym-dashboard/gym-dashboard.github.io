# My Gym Logs

This repository contains a simple D3-based dashboard for visualizing gym logs. It includes:

- **`index.html`**: Main HTML file
- **`style.css`**: Basic CSS for styling
- **`script.js`**: Contains the D3 logic to fetch & visualize the data
- **`data/`** folder with 3 example JSON logs (`19-03-2025.json`, `20-03-2025.json`, `22-03-2025.json`)

## How to Use

1. **Clone or Download** this repo.
2. Make sure the folder structure is the same as in this repo (i.e. the JSON files live in the `data/` folder).
3. **Enable GitHub Pages**:
   - Go to your repo’s **Settings** on GitHub.
   - Find the **Pages** section.
   - Select the branch (e.g. `main`) and the folder (root if your files are directly here).
   - Save.
4. You’ll get a public GitHub Pages URL, e.g. `https://YOUR_USERNAME.github.io/my-gym-logs/`.
5. **View Your Dashboard** by visiting that URL in your browser.

## Customizing

- Modify **`script.js`** to add or change charts as desired.
- Update **`style.css`** for styling tweaks.
- Add or remove JSON logs in the `data/` folder and then edit `script.js` (the `Promise.all([...])` portion) if you have a different number of days.

Have fun exploring your workout data!
