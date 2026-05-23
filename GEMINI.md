# Pebble Watchface Project Guidelines

## Resources
- Documentation: [RePebble Developer Documentation](https://developer.repebble.com/)

## Workflow
- Changes pushed to this repository automatically trigger a build on CloudPebble.
- The user relies on this auto-build to test changes visually.
- When making functional or visual changes, ensure they are ready to be committed and pushed so the user can verify them on CloudPebble.

## Architecture
- Based on Moddable SDK running on Pebble.
- `src/embeddedjs/main.js`: Main logic, API fetching, and drawing using Commodetto/Poco.
- `src/c/mdbl.c`: C entry point for the Moddable VM.
- `src/pkjs/`: Phone-side configuration using the Clay framework.
