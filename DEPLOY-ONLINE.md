# Put the 6529 Chat Feed Online

This folder is ready for GitHub and Render.

## Part 1 — Upload it to GitHub

1. Create a free GitHub account or sign in.
2. Click the plus sign in the upper-right corner.
3. Click **New repository**.
4. Repository name: `6529-chat-feed`
5. Choose **Public**.
6. Do not add a README, .gitignore, or license—the folder already has its files.
7. Click **Create repository**.
8. On the new repository page, click **uploading an existing file**.
9. Open this unzipped folder in Finder.
10. Select everything inside this folder and drag it into the GitHub upload box.
11. Wait for every file and the `public` folder to finish uploading.
12. At the bottom, click **Commit changes**.

## Part 2 — Publish it with Render

1. Create a Render account and choose **Sign in with GitHub**.
2. In the Render dashboard, click **New** and then **Web Service**.
3. Connect the `6529-chat-feed` GitHub repository.
4. Use these settings:

   - Name: `6529-chat-feed` (or another available name)
   - Language / Runtime: Node
   - Branch: `main`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: Free

5. Click **Create Web Service**.
6. Wait for the deploy log to say the service is live.
7. Open the public address Render gives you.

## Notes

- The free service can go to sleep after inactivity. Its first load afterward can be slower.
- Your Mac and Terminal do not need to stay on after the Render site is deployed.
- This version displays public API content only.
- You can add a purchased custom domain later from the service's Settings page.
