# Udyam Digital | Team GeoVision

Airtel SYNC Enterprise Track A prototype for the fictional Accel Business case. A buyer can describe business needs, select an eligible bundle, inspect monthly and one-time charges, consent to a synthetic registration check and see the next fulfilment step.

## Run the full demonstration

The browser demo in dist/ runs immediately. For the full local demo, obtain the organiser-supplied student ZIP and run the following in this folder on a compatible Mac with Python 3.10+ and Swift command-line tools:

    python3 import_case.py /path/to/6ae1873397bc1_digital.zip

Then start the service:

    python3 server.py

Open the loopback address printed by the server (by default http://127.0.0.1:8765). Keep the terminal open during the demo. The full local experience uses Apple Vision for specimen OCR and, on supported devices with the on-device model enabled, Apple Foundation Models for generative advice. It requires no cloud API key. The startup message reports the available modes. Read [the local service guide](LOCAL-SERVICE.md) for details.

## Portable offline version

Open [the browser prototype](dist/index.html) directly in a modern browser. The catalogue rules, quote controls, consent, labelled pre-extracted K02 clinic example and simulated order tracker work offline. Full model inference, image reading and registry lookup require the local service. The browser starts a fresh demo on reload.

## Two scenarios to reproduce

1. **Office purchase.** Use the Harmony Dental Care clinic example and get a quote. One business fibre line and five email seats cost ₹2,124/month with ₹0 setup, before applicable taxes. Add backup to get ₹2,623/month, ₹1,500 setup, and ₹4,123 for the first month plus setup. Use the local AI review if available. Accept, consent and use the supplied K02 GST specimen on the full local service. The static alternative is explicitly labelled as a pre-extracted sample. Place the simulated order and check which step still depends on the installer.
2. **No-GST salon.** Select the salon scenario from the start or open dist/index.html#salon. The WhatsApp Business API requires active GST registration. AirFiber and POS remain available. The buyer can proceed to assisted review for the eligible order. Verify the product prices and GST requirement directly in the supplied catalogue.

## Data and boundaries

Only synthetic materials supplied for the hackathon belong in this demo. Do not upload personal or real business identity documents. Prices are catalogue minimums multiplied by quantity before applicable tax. The longest minimum contract and typical longest installation estimate come from the selected products. Live payment, installation booking and operator provisioning are outside the prototype. The local service exposes the browser folder, not the registry source or the lead dataset.

The source is arranged as static files in dist/, a loopback service in server.py, native processing and reduced catalogue/registry data in service/, and locally imported synthetic test images in samples/. The importer keeps the organisers’ registry rows and document images off the public repository. The original 5,000-lead analysis file is not needed at runtime.
