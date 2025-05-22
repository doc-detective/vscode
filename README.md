# Doc Detective VSCode Extension

The Doc Detective VSCode Extension integrates the [Doc Detective](https://doc-detective.com) documentation testing framework directly into your Visual Studio Code environment. This extension helps you detect, view, and manage documentation tests embedded in your content files, making it easier to keep your documentation accurate and up-to-date.

## Features

- **Real-time Test Detection**: Automatically detects Doc Detective tests in your open files
- **Sidebar Integration**: View detected tests in a dedicated Doc Detective panel in the activity bar
- **Interactive Test Explorer**: Navigate through detected tests with collapsible sections for easy viewing
- **Syntax Highlighting**: Tests are displayed with proper syntax highlighting for improved readability

## How It Works

Doc Detective is a documentation testing framework that helps validate documentation against real product behavior. This extension uses `doc-detective-resolver` to scan your documentation files for embedded tests and displays them in the sidebar panel.
    
## Requirements

- Visual Studio Code v1.100.0 or higher

## Using Doc Detective Extension

1. Open a file that contains Doc Detective tests or inline test steps
2. Click the Doc Detective icon in the activity bar
3. Review the detected tests in your document

The extension will automatically scan open files for:
- Inline tests using HTML comments or markdown comment syntax
- Test specifications in YAML or JSON format
- Documentation with embedded test steps

## Related Projects

Doc Detective has multiple components that work together:

- [Doc Detective](https://github.com/doc-detective/doc-detective): The main CLI tool for running documentation tests
- [Doc Detective Resolver](https://github.com/doc-detective/resolver): Library for detecting tests in documentation files
- [Doc Detective Core](https://github.com/doc-detective/doc-detective-core): Core testing functionality
- [Doc Detective Companion](https://github.com/doc-detective/doc-detective-companion): Browser extension for test creation

## Release Notes

### 0.0.2

- Initial preview release
- Basic test detection functionality
- Sidebar panel integration
- Support for viewing detected tests

## Learn More

- [Doc Detective Documentation](https://doc-detective.com)
- [GitHub Repository](https://github.com/doc-detective/doc-detective-vsc)
- [Discord Community](https://discord.gg/2M7wXEThfF)

## Contributing

Interested in contributing to this extension? Check out the [Doc Detective GitHub organization](https://github.com/doc-detective) to learn more about the project and how to get involved.

---

**Made with ❤️ by the Doc Detective team**
