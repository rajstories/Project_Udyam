# Run the local prototype

Use Python 3.10 or later. Import the organiser’s student pack as described in the README before launching the local service.

```sh
python3 server.py
```

Open **http://127.0.0.1:8765** in a browser after the service prints its address. The first startup compiles a small Swift helper and can take about a minute. Use Ctrl+C to stop it. Choose a different port with `python3 server.py --port 8766`.

## Demo inputs

- The **samples** folder contains the four fictional K02 documents and a K11 address bill. The service accepts PNG and JPEG specimens up to 4 MB.
- On a supported Mac, the advisor uses the local Apple Intelligence model to match a free-text need to eligible catalogue IDs. The quote interface remains responsible for product rules, dependencies, prices, quantities and contract terms.
- With consent, certificate OCR extracts text, looks up the identifier and matches the printed enterprise name. A unique hit in the supplied mock registry and a compatible registration status are needed for a pass. Low-confidence extraction and mismatches go to review. The K11 address bill is outside the permitted 90-day window on the case reference date, 15 July 2026.
- A bill or signatory image receives a **document-date check**. It does not establish issuer authenticity, a verified installation address, identity or legal signing authority. Treat further verification as assisted review.
- Live OCR uses Apple Vision. Live generation uses Apple's local Foundation Models framework on macOS 26+ with Apple Intelligence enabled and its model downloaded. Both depend on an available Swift compiler and compatible SDK. These services were exercised on the submission-development Mac with synthetic files. On other systems, the browser’s catalogue workflow and the Python mock-registry service remain available. The `/api/health` endpoint reports local capabilities.

## Data and limits

The server binds only to the loopback address. Uploaded image bytes, extracted text and the model prompt are processed in memory. The service does not record request logs or save documents, images, prompts, or OCR text. The native helper receives them through standard input. Compiled helper files contain only program code. The included registries store an identifier hash mapped to the fictional trade name and status. Their contents stay outside the served directory. Registry responses show only a masked identifier and limited result fields. These are synthetic lookups. The static sample mode uses preloaded sample results.

No paid model service, external model credentials or production integrations are required. Activation dates are estimates, and a tracker status is a prototype state rather than a live installation update.

For a repeatable check, leave the server running and run `python3 check_demo.py` in a second terminal. It uses the bundled fictional documents and prints pass/skip status for each capability.
