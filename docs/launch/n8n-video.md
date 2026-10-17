# n8n demo video: shot list (n8n-nodes-svgnew 0.2.0)

One take, no cuts, under 5 minutes (aim for 4). Local n8n 2.43.7 at http://localhost:5678.

**Before you record:** sign in at localhost:5678 as the local test owner (demo.owner@example.com, password in `n8n-local-owner.txt`). Create an svg.new key (svg.new/account > **API keys** > create, starts `svk_`) and have your Anthropic or OpenAI key ready. Use a Chrome window with only the n8n tab. Credits needed: 4 (2 without Remove Background).

**Start recording (QuickTime):** QuickTime Player > File > New Screen Recording (or Cmd-Shift-5). Options: Save to QuickTime Player, Show Mouse Clicks on, Microphone None (or on for a voice-over). Pick **Record Selected Portion**, drag the frame over the Chrome window, click **Record**.

1. **Install (0:00).** Gear icon (bottom left) > **Community nodes** > **Install a community node**. Type `n8n-nodes-svgnew@0.2.0`, tick "I understand the risks…", click **Install**. Wait for "Package installed" and the `v0.2.0` row.
2. **Workflow (0:30).** Home icon > **Build a workflow** (or top-left **+** > New workflow). **Add first step…** > **Trigger manually**. Click the **+** after it, type `svg`, pick **SVG.new**, then **Vectorize image**. Point at "Actions (4)" on the way.
3. **Credential (0:50).** In the node: Credential > **Connect to SVG.new**. Say "the key comes from svg.new/account, API keys". Paste it (it's masked) and click **Save**. Wait for the green **Connection tested successfully**, then close the dialog.
4. **Vectorize Image (1:20), 1 credit.** Image Input: **Image URL**. Paste `https://svg.new/examples/robot-mascot/robot-mascot-original.webp`. Click **Execute step**. Show the output: JSON (`id`, `metadata.credits_remaining`, `svg`), then the **Binary** tab (`robot-mascot-original.svg`). n8n offers only Download for SVG files, not View. Close the node.
5. **Simplify SVG Colors (1:50), free.** **+** after SVG.new > `svg` > **SVG.new** > **Simplify SVG colors**. Keep SVG Input: Binary File, field `data`. Set Max Colors to `3`. **Execute step**. Show `colorsBefore` → `colorsAfter` and `robot-mascot-original-simplified.svg`. Close.
6. **Remove Background (2:15), 2 credits. Skip if past 2:30.** **+** > **SVG.new** > **Remove background from image**. Image Input: **Image URL**, `https://svg.new/examples/cactus-sticker/cactus-sticker-original.webp`. Keep SVG Input: Vectorize the Image First. **Execute step**. Binary tab > `transparentImage` > **View** (the cactus without its blue background). Close.
7. **AI agent (2:45).** Top-left **+** > **New workflow**. **Add first step…** > type `ai agent` > click **AI Agent** (not "Message an Agent"). n8n adds "When chat message received" for you. Close the agent panel.
   - Under the agent, **Chat Model +** > type `anthropic` (or `openai`) > **Anthropic Chat Model**. Credential: connect a new one, paste your key, **Save**, wait for the green test, close.
   - **Tool +** > type `svg` > **SVG.new Tool**. The SVG.new credential is already selected. Operation: Vectorize Image. Image Input: **Image URL**. Click the ✨ button on the Image URL field ("Let the model define this parameter"). Close.
   - **Open chat** (bottom centre) and send:
     `Vectorize https://svg.new/examples/bluebird-studio-mark/bluebird-studio-mark-original.webp with SVG.new and tell me the vectorization ID and how many credits I have left.`
   - When it replies, point at the SVG.new Tool call in the Logs panel (its input URL and output). 1 credit.
8. **Stop (≈4:00).** Click the stop button in the menu bar (or Cmd-Ctrl-Esc). The recording opens in QuickTime: File > Save, name it `n8n-nodes-svgnew-0.2.0-demo`, save to Desktop (.mov). If it's very large, use File > Export As > 1080p instead.

**Upload:** sign in at creators.n8n.io and open creators.n8n.io/nodes/n8n-nodes-svgnew/integration. Drag the .mov onto "Drag video here or click to upload". The form takes any video file, so .mov is fine. Or paste a Loom/YouTube link under "Alternatively, enter a link to your video". Click **✓ Submit for review**.

**Cost of the run:** credential test 0, Vectorize 1, Simplify 0, Remove Background 2, agent call 1, so 4 svg.new credits in total (2 if you skip step 6). The chat model costs a few cents on your own key. Each retry adds the same amounts again.

**Gotchas:** In the Operation list, n8n adds a fifth option, **Custom API Call**. Don't pick it. When the node is used as a tool, it must use Image URL with ✨, because an agent can't pass a binary file.

**Afterwards, delete the local n8n:**

```sh
docker rm -f n8n-svgnew-demo
docker volume rm n8n-svgnew-demo
docker image rm docker.n8n.io/n8nio/n8n:stable
```

Also delete the svg.new key you made for the video at svg.new/account, if you don't need it again.
