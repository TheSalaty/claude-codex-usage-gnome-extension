UUID    := ai-usage-monitor@thesalaty.github.io
BUILD   := build/src
TARGET  := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: all build schemas install uninstall pack test clean enable disable logs

all: build

build:
	npx tsc -p tsconfig.json

schemas: build
	mkdir -p $(BUILD)/schemas
	cp src/schemas/*.gschema.xml $(BUILD)/schemas/
	glib-compile-schemas $(BUILD)/schemas

assets: build
	cp src/metadata.json src/stylesheet.css $(BUILD)/
	cp -r src/icons $(BUILD)/

install: schemas assets
	rm -rf $(TARGET)
	mkdir -p $(TARGET)
	cp -r $(BUILD)/. $(TARGET)/
	@echo "Installed to $(TARGET)"
	@echo "Log out and back in (Wayland), then: gnome-extensions enable $(UUID)"

uninstall:
	rm -rf $(TARGET)

pack: schemas assets
	cd $(BUILD) && zip -qr ../../$(UUID).shell-extension.zip .
	@echo "Wrote $(UUID).shell-extension.zip"

test:
	npx tsc -p tsconfig.json
	node --test build/tests/*.test.js

enable:
	gnome-extensions enable $(UUID)

disable:
	gnome-extensions disable $(UUID)

logs:
	journalctl -f -o cat /usr/bin/gnome-shell

clean:
	rm -rf build $(UUID).shell-extension.zip
