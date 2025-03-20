# Setup

1. Install deps: `yarn` cause ableton-js uses it for some build scripts and `pnpm`.

`npm install --global yarn`
`brew install pnpm`

2. Install the `midi-script` in ableton:

`git clone https://github.com/leolabs/ableton-js.git && cd ableton-js && yarn ableton11:start`

3. Clone the ableton-vibe mcp server if you havent yet:

`git clone https://github.com/androidStern/ableton-vibe.git && cd ableton-vibe && pnpm i`

4. Build and watch changes:

`npm run build`

5. Add mcp config to claude. General instructions [here](https://modelcontextprotocol.io/quickstart/user)

replace `path-to-repo` with path to wherever you cloned ableton-vibe
as for where claude's config is: on my machine the mcp config is in `~/Library/Application Support/Claude/claude_desktop_config.json/`

```json
{
  "mcpServers": {
    "ableton-vibe": {
      "command": "node",
      "args": ["<path-to-repo>/ableton-vibe/ableton-mcp.js"]
    }
  }
}
```

# Usage

Make sure you have Ableton running.
Restart claude before trying to use the server.
Try asking claude "Create a midi track at index 0". thats all it can do right now lol.

## Supported Ableton versions

I have tested with Ableton 11. Haven't tried with Ableton 12.

## Supported OS

I've only tried this on my mac. I suspect you might need to change ablton-mcp.ts line 9 to get the temp directory logic working for windows but I haven't given it much thought yet. here's the relevant line `const userTempDir = execSync('getconf DARWIN_USER_TEMP_DIR').toString().trim()`

## Debugging

you can run the mcp inspector to quickly debug the server: `npm run inspect` then open the url in the output. Instructions for using the inspector are [here](https://modelcontextprotocol.io/docs/tools/inspector)

# Running Test Add Device Script

`test-browser.js` is an example script to add a device to your ableton set programaticaly. Ableton must be running and the ableton-js midi-remote script must be installed. Refer to step # 2 of Setup at the top of this file to see how to install midi-remote script.

```bash
node test-browser.js
```

# Contributing

Right now everything is in ablton-mcp.ts so if you're adding tools or resources, put it there.
Don't edit the ablton-mcp._JS_ file, you want the _TS_ file.

# Next Steps

- get propper build and release setup. should be able to just install everything with a single command.
- add the rest of the ableton api as mcp tools. i dont really want to do this by hand. it would be nice to discover and expose it all programatically.
- add support for ableton 12
- add tests
- add support for other os (windows)
- voice controll
