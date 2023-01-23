# Doc Detective

![Current version](https://img.shields.io/github/package-json/v/doc-detective/doc-detective-vsc?color=orange)
[![Visual Studio Marketplace Shield](https://img.shields.io/visual-studio-marketplace/v/DocDetective.doc-detective?color=blue&label=visual%20studio%20marketplace)](https://marketplace.visualstudio.com/items?itemName=DocDetective.doc-detective)
[![Discord Shield](https://discordapp.com/api/guilds/1066417654899937453/widget.png?style=shield)](https://discord.gg/mSCCRAhH)

This extension brings [Doc Detective](https://github.com/hawkeyexl/doc-detective) to Visual Studio Code! Run tests and analyze content test coverage without having to leave your source files.

## Features

* Run tests in the active file.
* Run all tests in your default input path.
* Analyze test coverage for the active file.
* Analyze test coverage for all files in your default input path.

> Note: This extension doesn't yet support suggesting tests from source files.

## Requirements

To run this extension, you need a complete [`config.json`](https://github.com/hawkeyexl/doc-detective/blob/main/sample/config.json), just as if you were using Doc Detective as an NPM package or CLI tool.

## Extension Settings

This extension contributes the following settings:

* `docDetective.config`: The path to your `config.json` file. Relative paths evaluate from the root of your current workspace.

## Known Issues

This is an alpha release. Don't use it unless you know what you're doing.

## Release Notes

### 0.0.1

Initial alpha release.
