'use strict';

var obsidian = require('obsidian');

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

class ActiveNoteTitlePlugin extends obsidian.Plugin {
    constructor() {
        super(...arguments);
        // Get the window title
        this.baseTitle = document.title;
        // Debounced refreshTitle
        this.debouncedRefreshTitle = obsidian.debounce((file) => {
            this.refreshTitle(file);
        }, 500, false);
        this.handleRename = (file, oldPath) => __awaiter(this, void 0, void 0, function* () {
            // console.log(`file: ${oldPath} renamed to: ${file.path}`);
            if (file instanceof obsidian.TFile && file === this.app.workspace.getActiveFile()) {
                this.app.metadataCache.onCleanCache(() => { this.refreshTitle(file); });
            }
        });
        this.handleDelete = (file) => __awaiter(this, void 0, void 0, function* () {
            this.refreshTitle();
        });
        this.handleOpen = (file) => __awaiter(this, void 0, void 0, function* () {
            if (file instanceof obsidian.TFile && file === this.app.workspace.getActiveFile()) {
                this.debouncedRefreshTitle(file);
            }
        });
        this.handleLeafChange = (leaf) => __awaiter(this, void 0, void 0, function* () {
            this.debouncedRefreshTitle();
        });
        this.handleMetaChange = (file) => __awaiter(this, void 0, void 0, function* () {
            if (file instanceof obsidian.TFile && file === this.app.workspace.getActiveFile()) {
                this.refreshTitle(file);
            }
        });
        this.handleMetaResolve = (file) => __awaiter(this, void 0, void 0, function* () {
            if (file instanceof obsidian.TFile && file === this.app.workspace.getActiveFile()) {
                this.refreshTitle(file);
            }
        });
    }
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            // Show the plugin is loading for developers
            console.log(`loading ${this.manifest.id} plugin`);
            // parse the version from the original title string
            if (this.baseTitle == '' || this.baseTitle == undefined) {
                console.log('baseTitle is unset');
                this.baseTitle = 'Obsidian';
            }
            const m = this.baseTitle.match(/v([0-9.]+)$/);
            this.appVer = m[m.length - 1] || '';
            //console.log(`appVer set to [${this.appVer}]`);
            // Load the settings
            yield this.loadSettings();
            // Add the settings tab
            this.addSettingTab(new ActiveNoteTitlePluginSettingsTab(this.app, this));
            // Set up initial title change
            this.app.workspace.onLayoutReady(this.initialize.bind(this));
            this.refreshTitle();
            //this.app.metadataCache.onCleanCache(this.handleMeta.bind(this));
        });
    }
    initialize() {
        // console.log('registering callbacks');
        // When opening, renaming, or deleting a file, update the window title
        this.registerEvent(this.app.workspace.on('file-open', this.handleOpen));
        this.registerEvent(this.app.workspace.on('active-leaf-change', this.handleLeafChange));
        this.registerEvent(this.app.vault.on('rename', this.handleRename));
        this.registerEvent(this.app.vault.on('delete', this.handleDelete));
        this.registerEvent(this.app.metadataCache.on('changed', this.handleMetaChange));
        //this.registerEvent(this.app.metadataCache.on('resolve', this.handleMetaResolve));
    }
    // Restore original title on unload.
    onunload() {
        console.log(`unloading ${this.manifest.id} plugin`);
        //console.log(`reverting title to '${this.baseTitle}'`);
        document.title = this.baseTitle;
    }
    // The main method that is responsible for updating the title
    refreshTitle(file) {
        let template;
        if (!file) {
            file = this.app.workspace.getActiveFile() || undefined;
        }
        // For the template, the vault and workspace are always available
        template = {
            'vault': this.app.vault.getName(),
            'version': (this.appVer || ''),
            'workspace': this.app.internalPlugins.plugins.workspaces.instance.activeWorkspace // Defaults to: '' if not enabled
        };
        if (file instanceof obsidian.TFile) {
            // If a file is open, the filename, path and frontmatter is added
            let cache = this.app.metadataCache.getFileCache(file);
            if (cache && cache.frontmatter) {
                const isTemplate = new RegExp('<%');
                for (const [frontmatterKey, frontmatterValue] of Object.entries(cache.frontmatter || {})) {
                    let k = ('frontmatter.' + frontmatterKey);
                    if (!isTemplate.test(frontmatterValue)) {
                        template[k] = frontmatterValue;
                    }
                }
            }
            let friendlyBasename = file.basename;
            if (file.extension !== 'md') {
                friendlyBasename = file.name;
            }
            template = Object.assign({ 'filepath': file.path, 'filename': file.name, 'basename': friendlyBasename, 'extension': file.extension }, template);
            //console.log(template)
            document.title = this.templateTitle(template, this.settings.titleTemplate);
        }
        else {
            document.title = this.templateTitle(template, this.settings.titleTemplateEmpty);
        }
    }
    templateTitle(template, title) {
        let delimStr = this.settings.delimStr;
        let titleSeparator = this.settings.titleSeparator;
        if (this.settings.overrideYamlField !== null && this.settings.overrideYamlField.length > 0) {
            let titleOverride = String('frontmatter.' + this.settings.overrideYamlField);
            if (template[titleOverride]) {
                // console.log('override title: %s', template[titleOverride]);
                return template[titleOverride];
            }
        }
        // Process each template key
        Object.keys(template).forEach(field => {
            const hasField = new RegExp(`{{${field}}}`);
            //console.log(`%cchecking if ${title} contains {{${field}}}`, 'background: #222; color: #a0ffff');
            //console.log('bool: ' + hasField.test(title));
            //console.log('type of field: ' + typeof(field));
            //console.log(`val: [${template[field]}]`);
            if (hasField.test(title) && template[field] !== null && String(template[field]).length > 0) {
                //console.log(`%cexecuting transforms: [${field}] --> [${template[field]}]`, 'background: #222; color: #bada55');
                let re = new RegExp(`{{${field}}}`);
                title = title.replace(re, `${template[field]}`);
            }
        });
        // clean up delimiters
        let re = /([(]+)?{{[^}]+}}([)]+)?/g;
        title = title.replace(re, '');
        // clean up delimiters
        const replacements = new Map([
            [`^${delimStr}`, ''],
            [`${delimStr}+`, delimStr],
            [`${delimStr}(?!\ )`, titleSeparator],
            [`(?<!\ )${delimStr}`, ''],
        ]);
        for (const [key, value] of replacements) {
            let re = new RegExp(key, 'g');
            title = title.replace(re, value);
        }
        return title;
    }
    ;
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
}
const DEFAULT_SETTINGS = {
    titleTemplate: "{{basename}}~~{{vault}} - Obsidian v{{version}}",
    titleTemplateEmpty: "{{vault}} - Obsidian v{{version}}",
    titleSeparator: " - ",
    delimStr: "~~",
    overrideYamlField: "title"
};
class ActiveNoteTitlePluginSettingsTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        let { containerEl } = this;
        let desc;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Window title templates' });
        containerEl.createEl('p', { text: 'These two templates override the window title of the Obsidian window. This is useful for example when you use tracking software that works with window titles. You can use the format `~~{{placeholder}}~~` if you want the placeholder to be completely omitted when blank, otherwise whitespace and other characters will be preserved. You can surround a placeholder with parentheses e.g. `({{frontmatter.project}})` and it will be hidden if the referenced field is empty.' });
        desc = document.createDocumentFragment();
        desc.append('Available ');
        desc.createEl('b').innerText = 'placeholders:';
        let placeholders = [
            ["vault", "workspace", "version"],
            ["filename", "filepath", "basename", "extension"],
            ["frontmatter.<any_frontmatter_key>"]
        ];
        placeholders.forEach(row => {
            desc.createEl("br");
            row.forEach(key => {
                desc.append(`{{${key}}} `);
            });
        });
        new obsidian.Setting(containerEl)
            .setName('Default Template')
            .setDesc(desc)
            .addText(text => {
            text.inputEl.style.fontFamily = 'monospace';
            text.inputEl.style.width = '500px';
            text.inputEl.style.height = '46px';
            text
                .setPlaceholder(DEFAULT_SETTINGS.titleTemplate)
                .setValue(this.plugin.settings.titleTemplate)
                .onChange((value) => {
                this.plugin.settings.titleTemplate = value;
                this.plugin.saveData(this.plugin.settings);
                this.plugin.refreshTitle();
            });
        });
        new obsidian.Setting(containerEl)
            .setName('YAML Frontmatter Title Override Field')
            .setDesc('If this frontmatter field is present, use its value as the title instead of dynamically calculating it.')
            .addText(text => {
            text.inputEl.style.fontFamily = 'monospace';
            text.inputEl.style.width = '500px';
            text.inputEl.style.height = '46px';
            text
                .setPlaceholder(DEFAULT_SETTINGS.overrideYamlField)
                .setValue(this.plugin.settings.overrideYamlField)
                .onChange((value) => {
                this.plugin.settings.overrideYamlField = value;
                this.plugin.saveData(this.plugin.settings);
                this.plugin.refreshTitle();
            });
        });
        desc = document.createDocumentFragment();
        desc.append('Available ');
        desc.createEl('b').innerText = 'placeholders:';
        placeholders = [
            ["vault", "workspace", "version"],
        ];
        placeholders.forEach(key => {
            desc.createEl("br");
            desc.append(`{{${key}}}`);
        });
        new obsidian.Setting(containerEl)
            .setName('Template for when no file is open')
            .setDesc(desc)
            .addText(text => {
            text.inputEl.style.fontFamily = 'monospace';
            text.inputEl.style.width = '500px';
            text.inputEl.style.height = '46px';
            text
                .setPlaceholder(DEFAULT_SETTINGS.titleTemplateEmpty)
                .setValue(this.plugin.settings.titleTemplateEmpty)
                .onChange((value) => {
                this.plugin.settings.titleTemplateEmpty = value;
                this.plugin.saveData(this.plugin.settings);
                this.plugin.refreshTitle();
            });
        });
        new obsidian.Setting(containerEl)
            .setName('Separator to insert between placeholder elements')
            .setDesc('Replaces delimiter string between placeholders that are not null.')
            .addText(text => {
            text.inputEl.style.fontFamily = 'monospace';
            text.inputEl.style.width = '142px';
            text.inputEl.style.height = '46px';
            text
                .setPlaceholder(' - ')
                .setValue(this.plugin.settings.titleSeparator)
                .onChange((value) => {
                this.plugin.settings.titleSeparator = value;
                this.plugin.saveData(this.plugin.settings);
                this.plugin.refreshTitle();
            });
        });
        new obsidian.Setting(containerEl)
            .setName('Delimiter string')
            .setDesc('Select a string to be used to mark locations for separators to be inserted.')
            .addDropdown((dropdown) => {
            dropdown.addOption('~~', '~~ (Tilde)');
            dropdown.addOption('##', '## (Hash)');
            dropdown.addOption('__', '__ (Underscore)');
            dropdown.setValue(this.plugin.settings.delimStr);
            dropdown.onChange((option) => {
                this.plugin.settings.delimStr = option;
                this.plugin.saveData(this.plugin.settings);
                this.plugin.refreshTitle();
            });
        });
    }
}

module.exports = ActiveNoteTitlePlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsIm1haW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyohICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkNvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLlxyXG5cclxuUGVybWlzc2lvbiB0byB1c2UsIGNvcHksIG1vZGlmeSwgYW5kL29yIGRpc3RyaWJ1dGUgdGhpcyBzb2Z0d2FyZSBmb3IgYW55XHJcbnB1cnBvc2Ugd2l0aCBvciB3aXRob3V0IGZlZSBpcyBoZXJlYnkgZ3JhbnRlZC5cclxuXHJcblRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIgQU5EIFRIRSBBVVRIT1IgRElTQ0xBSU1TIEFMTCBXQVJSQU5USUVTIFdJVEhcclxuUkVHQVJEIFRPIFRISVMgU09GVFdBUkUgSU5DTFVESU5HIEFMTCBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZXHJcbkFORCBGSVRORVNTLiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SIEJFIExJQUJMRSBGT1IgQU5ZIFNQRUNJQUwsIERJUkVDVCxcclxuSU5ESVJFQ1QsIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyBPUiBBTlkgREFNQUdFUyBXSEFUU09FVkVSIFJFU1VMVElORyBGUk9NXHJcbkxPU1MgT0YgVVNFLCBEQVRBIE9SIFBST0ZJVFMsIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBORUdMSUdFTkNFIE9SXHJcbk9USEVSIFRPUlRJT1VTIEFDVElPTiwgQVJJU0lORyBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBVU0UgT1JcclxuUEVSRk9STUFOQ0UgT0YgVEhJUyBTT0ZUV0FSRS5cclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuLyogZ2xvYmFsIFJlZmxlY3QsIFByb21pc2UgKi9cclxuXHJcbnZhciBleHRlbmRTdGF0aWNzID0gZnVuY3Rpb24oZCwgYikge1xyXG4gICAgZXh0ZW5kU3RhdGljcyA9IE9iamVjdC5zZXRQcm90b3R5cGVPZiB8fFxyXG4gICAgICAgICh7IF9fcHJvdG9fXzogW10gfSBpbnN0YW5jZW9mIEFycmF5ICYmIGZ1bmN0aW9uIChkLCBiKSB7IGQuX19wcm90b19fID0gYjsgfSkgfHxcclxuICAgICAgICBmdW5jdGlvbiAoZCwgYikgeyBmb3IgKHZhciBwIGluIGIpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYiwgcCkpIGRbcF0gPSBiW3BdOyB9O1xyXG4gICAgcmV0dXJuIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHRlbmRzKGQsIGIpIHtcclxuICAgIGlmICh0eXBlb2YgYiAhPT0gXCJmdW5jdGlvblwiICYmIGIgIT09IG51bGwpXHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNsYXNzIGV4dGVuZHMgdmFsdWUgXCIgKyBTdHJpbmcoYikgKyBcIiBpcyBub3QgYSBjb25zdHJ1Y3RvciBvciBudWxsXCIpO1xyXG4gICAgZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxuICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxyXG4gICAgZC5wcm90b3R5cGUgPSBiID09PSBudWxsID8gT2JqZWN0LmNyZWF0ZShiKSA6IChfXy5wcm90b3R5cGUgPSBiLnByb3RvdHlwZSwgbmV3IF9fKCkpO1xyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fYXNzaWduID0gZnVuY3Rpb24oKSB7XHJcbiAgICBfX2Fzc2lnbiA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gX19hc3NpZ24odCkge1xyXG4gICAgICAgIGZvciAodmFyIHMsIGkgPSAxLCBuID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IG47IGkrKykge1xyXG4gICAgICAgICAgICBzID0gYXJndW1lbnRzW2ldO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkpIHRbcF0gPSBzW3BdO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdDtcclxuICAgIH1cclxuICAgIHJldHVybiBfX2Fzc2lnbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXN0KHMsIGUpIHtcclxuICAgIHZhciB0ID0ge307XHJcbiAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkgJiYgZS5pbmRleE9mKHApIDwgMClcclxuICAgICAgICB0W3BdID0gc1twXTtcclxuICAgIGlmIChzICE9IG51bGwgJiYgdHlwZW9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMgPT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgcCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocyk7IGkgPCBwLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChlLmluZGV4T2YocFtpXSkgPCAwICYmIE9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChzLCBwW2ldKSlcclxuICAgICAgICAgICAgICAgIHRbcFtpXV0gPSBzW3BbaV1dO1xyXG4gICAgICAgIH1cclxuICAgIHJldHVybiB0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYykge1xyXG4gICAgdmFyIGMgPSBhcmd1bWVudHMubGVuZ3RoLCByID0gYyA8IDMgPyB0YXJnZXQgOiBkZXNjID09PSBudWxsID8gZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBrZXkpIDogZGVzYywgZDtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5kZWNvcmF0ZSA9PT0gXCJmdW5jdGlvblwiKSByID0gUmVmbGVjdC5kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYyk7XHJcbiAgICBlbHNlIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBpZiAoZCA9IGRlY29yYXRvcnNbaV0pIHIgPSAoYyA8IDMgPyBkKHIpIDogYyA+IDMgPyBkKHRhcmdldCwga2V5LCByKSA6IGQodGFyZ2V0LCBrZXkpKSB8fCByO1xyXG4gICAgcmV0dXJuIGMgPiAzICYmIHIgJiYgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCByKSwgcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcGFyYW0ocGFyYW1JbmRleCwgZGVjb3JhdG9yKSB7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKHRhcmdldCwga2V5KSB7IGRlY29yYXRvcih0YXJnZXQsIGtleSwgcGFyYW1JbmRleCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpIHtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5tZXRhZGF0YSA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gUmVmbGVjdC5tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0ZXIodGhpc0FyZywgX2FyZ3VtZW50cywgUCwgZ2VuZXJhdG9yKSB7XHJcbiAgICBmdW5jdGlvbiBhZG9wdCh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBQID8gdmFsdWUgOiBuZXcgUChmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXNvbHZlKHZhbHVlKTsgfSk7IH1cclxuICAgIHJldHVybiBuZXcgKFAgfHwgKFAgPSBQcm9taXNlKSkoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIGZ1bmN0aW9uIGZ1bGZpbGxlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvci5uZXh0KHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiByZWplY3RlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvcltcInRocm93XCJdKHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiBzdGVwKHJlc3VsdCkgeyByZXN1bHQuZG9uZSA/IHJlc29sdmUocmVzdWx0LnZhbHVlKSA6IGFkb3B0KHJlc3VsdC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTsgfVxyXG4gICAgICAgIHN0ZXAoKGdlbmVyYXRvciA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSkubmV4dCgpKTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19nZW5lcmF0b3IodGhpc0FyZywgYm9keSkge1xyXG4gICAgdmFyIF8gPSB7IGxhYmVsOiAwLCBzZW50OiBmdW5jdGlvbigpIHsgaWYgKHRbMF0gJiAxKSB0aHJvdyB0WzFdOyByZXR1cm4gdFsxXTsgfSwgdHJ5czogW10sIG9wczogW10gfSwgZiwgeSwgdCwgZztcclxuICAgIHJldHVybiBnID0geyBuZXh0OiB2ZXJiKDApLCBcInRocm93XCI6IHZlcmIoMSksIFwicmV0dXJuXCI6IHZlcmIoMikgfSwgdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIChnW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXM7IH0pLCBnO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IHJldHVybiBmdW5jdGlvbiAodikgeyByZXR1cm4gc3RlcChbbiwgdl0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKG9wKSB7XHJcbiAgICAgICAgaWYgKGYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJHZW5lcmF0b3IgaXMgYWxyZWFkeSBleGVjdXRpbmcuXCIpO1xyXG4gICAgICAgIHdoaWxlIChfKSB0cnkge1xyXG4gICAgICAgICAgICBpZiAoZiA9IDEsIHkgJiYgKHQgPSBvcFswXSAmIDIgPyB5W1wicmV0dXJuXCJdIDogb3BbMF0gPyB5W1widGhyb3dcIl0gfHwgKCh0ID0geVtcInJldHVyblwiXSkgJiYgdC5jYWxsKHkpLCAwKSA6IHkubmV4dCkgJiYgISh0ID0gdC5jYWxsKHksIG9wWzFdKSkuZG9uZSkgcmV0dXJuIHQ7XHJcbiAgICAgICAgICAgIGlmICh5ID0gMCwgdCkgb3AgPSBbb3BbMF0gJiAyLCB0LnZhbHVlXTtcclxuICAgICAgICAgICAgc3dpdGNoIChvcFswXSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAwOiBjYXNlIDE6IHQgPSBvcDsgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDQ6IF8ubGFiZWwrKzsgcmV0dXJuIHsgdmFsdWU6IG9wWzFdLCBkb25lOiBmYWxzZSB9O1xyXG4gICAgICAgICAgICAgICAgY2FzZSA1OiBfLmxhYmVsKys7IHkgPSBvcFsxXTsgb3AgPSBbMF07IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA3OiBvcCA9IF8ub3BzLnBvcCgpOyBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICBpZiAoISh0ID0gXy50cnlzLCB0ID0gdC5sZW5ndGggPiAwICYmIHRbdC5sZW5ndGggLSAxXSkgJiYgKG9wWzBdID09PSA2IHx8IG9wWzBdID09PSAyKSkgeyBfID0gMDsgY29udGludWU7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDMgJiYgKCF0IHx8IChvcFsxXSA+IHRbMF0gJiYgb3BbMV0gPCB0WzNdKSkpIHsgXy5sYWJlbCA9IG9wWzFdOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gNiAmJiBfLmxhYmVsIDwgdFsxXSkgeyBfLmxhYmVsID0gdFsxXTsgdCA9IG9wOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0ICYmIF8ubGFiZWwgPCB0WzJdKSB7IF8ubGFiZWwgPSB0WzJdOyBfLm9wcy5wdXNoKG9wKTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodFsyXSkgXy5vcHMucG9wKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBvcCA9IGJvZHkuY2FsbCh0aGlzQXJnLCBfKTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7IG9wID0gWzYsIGVdOyB5ID0gMDsgfSBmaW5hbGx5IHsgZiA9IHQgPSAwOyB9XHJcbiAgICAgICAgaWYgKG9wWzBdICYgNSkgdGhyb3cgb3BbMV07IHJldHVybiB7IHZhbHVlOiBvcFswXSA/IG9wWzFdIDogdm9pZCAwLCBkb25lOiB0cnVlIH07XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19jcmVhdGVCaW5kaW5nID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBrMiwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4gbVtrXTsgfSB9KTtcclxufSkgOiAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICBvW2syXSA9IG1ba107XHJcbn0pO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXhwb3J0U3RhcihtLCBvKSB7XHJcbiAgICBmb3IgKHZhciBwIGluIG0pIGlmIChwICE9PSBcImRlZmF1bHRcIiAmJiAhT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG8sIHApKSBfX2NyZWF0ZUJpbmRpbmcobywgbSwgcCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3ZhbHVlcyhvKSB7XHJcbiAgICB2YXIgcyA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBTeW1ib2wuaXRlcmF0b3IsIG0gPSBzICYmIG9bc10sIGkgPSAwO1xyXG4gICAgaWYgKG0pIHJldHVybiBtLmNhbGwobyk7XHJcbiAgICBpZiAobyAmJiB0eXBlb2Ygby5sZW5ndGggPT09IFwibnVtYmVyXCIpIHJldHVybiB7XHJcbiAgICAgICAgbmV4dDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAobyAmJiBpID49IG8ubGVuZ3RoKSBvID0gdm9pZCAwO1xyXG4gICAgICAgICAgICByZXR1cm4geyB2YWx1ZTogbyAmJiBvW2krK10sIGRvbmU6ICFvIH07XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IocyA/IFwiT2JqZWN0IGlzIG5vdCBpdGVyYWJsZS5cIiA6IFwiU3ltYm9sLml0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVhZChvLCBuKSB7XHJcbiAgICB2YXIgbSA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvW1N5bWJvbC5pdGVyYXRvcl07XHJcbiAgICBpZiAoIW0pIHJldHVybiBvO1xyXG4gICAgdmFyIGkgPSBtLmNhbGwobyksIHIsIGFyID0gW10sIGU7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIHdoaWxlICgobiA9PT0gdm9pZCAwIHx8IG4tLSA+IDApICYmICEociA9IGkubmV4dCgpKS5kb25lKSBhci5wdXNoKHIudmFsdWUpO1xyXG4gICAgfVxyXG4gICAgY2F0Y2ggKGVycm9yKSB7IGUgPSB7IGVycm9yOiBlcnJvciB9OyB9XHJcbiAgICBmaW5hbGx5IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBpZiAociAmJiAhci5kb25lICYmIChtID0gaVtcInJldHVyblwiXSkpIG0uY2FsbChpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZmluYWxseSB7IGlmIChlKSB0aHJvdyBlLmVycm9yOyB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gYXI7XHJcbn1cclxuXHJcbi8qKiBAZGVwcmVjYXRlZCAqL1xyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWQoKSB7XHJcbiAgICBmb3IgKHZhciBhciA9IFtdLCBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKylcclxuICAgICAgICBhciA9IGFyLmNvbmNhdChfX3JlYWQoYXJndW1lbnRzW2ldKSk7XHJcbiAgICByZXR1cm4gYXI7XHJcbn1cclxuXHJcbi8qKiBAZGVwcmVjYXRlZCAqL1xyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheXMoKSB7XHJcbiAgICBmb3IgKHZhciBzID0gMCwgaSA9IDAsIGlsID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGlsOyBpKyspIHMgKz0gYXJndW1lbnRzW2ldLmxlbmd0aDtcclxuICAgIGZvciAodmFyIHIgPSBBcnJheShzKSwgayA9IDAsIGkgPSAwOyBpIDwgaWw7IGkrKylcclxuICAgICAgICBmb3IgKHZhciBhID0gYXJndW1lbnRzW2ldLCBqID0gMCwgamwgPSBhLmxlbmd0aDsgaiA8IGpsOyBqKyssIGsrKylcclxuICAgICAgICAgICAgcltrXSA9IGFbal07XHJcbiAgICByZXR1cm4gcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXkodG8sIGZyb20sIHBhY2spIHtcclxuICAgIGlmIChwYWNrIHx8IGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIGZvciAodmFyIGkgPSAwLCBsID0gZnJvbS5sZW5ndGgsIGFyOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgaWYgKGFyIHx8ICEoaSBpbiBmcm9tKSkge1xyXG4gICAgICAgICAgICBpZiAoIWFyKSBhciA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGZyb20sIDAsIGkpO1xyXG4gICAgICAgICAgICBhcltpXSA9IGZyb21baV07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRvLmNvbmNhdChhciB8fCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChmcm9tKSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0KHYpIHtcclxuICAgIHJldHVybiB0aGlzIGluc3RhbmNlb2YgX19hd2FpdCA/ICh0aGlzLnYgPSB2LCB0aGlzKSA6IG5ldyBfX2F3YWl0KHYpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0dlbmVyYXRvcih0aGlzQXJnLCBfYXJndW1lbnRzLCBnZW5lcmF0b3IpIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgZyA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSwgaSwgcSA9IFtdO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlmIChnW25dKSBpW25dID0gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChhLCBiKSB7IHEucHVzaChbbiwgdiwgYSwgYl0pID4gMSB8fCByZXN1bWUobiwgdik7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiByZXN1bWUobiwgdikgeyB0cnkgeyBzdGVwKGdbbl0odikpOyB9IGNhdGNoIChlKSB7IHNldHRsZShxWzBdWzNdLCBlKTsgfSB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKHIpIHsgci52YWx1ZSBpbnN0YW5jZW9mIF9fYXdhaXQgPyBQcm9taXNlLnJlc29sdmUoci52YWx1ZS52KS50aGVuKGZ1bGZpbGwsIHJlamVjdCkgOiBzZXR0bGUocVswXVsyXSwgcik7IH1cclxuICAgIGZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHsgcmVzdW1lKFwibmV4dFwiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHJlamVjdCh2YWx1ZSkgeyByZXN1bWUoXCJ0aHJvd1wiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShmLCB2KSB7IGlmIChmKHYpLCBxLnNoaWZ0KCksIHEubGVuZ3RoKSByZXN1bWUocVswXVswXSwgcVswXVsxXSk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNEZWxlZ2F0b3Iobykge1xyXG4gICAgdmFyIGksIHA7XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIsIGZ1bmN0aW9uIChlKSB7IHRocm93IGU7IH0pLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlbbl0gPSBvW25dID8gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIChwID0gIXApID8geyB2YWx1ZTogX19hd2FpdChvW25dKHYpKSwgZG9uZTogbiA9PT0gXCJyZXR1cm5cIiB9IDogZiA/IGYodikgOiB2OyB9IDogZjsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY1ZhbHVlcyhvKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIG0gPSBvW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSwgaTtcclxuICAgIHJldHVybiBtID8gbS5jYWxsKG8pIDogKG8gPSB0eXBlb2YgX192YWx1ZXMgPT09IFwiZnVuY3Rpb25cIiA/IF9fdmFsdWVzKG8pIDogb1tTeW1ib2wuaXRlcmF0b3JdKCksIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpKTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyBpW25dID0gb1tuXSAmJiBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkgeyB2ID0gb1tuXSh2KSwgc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgdi5kb25lLCB2LnZhbHVlKTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShyZXNvbHZlLCByZWplY3QsIGQsIHYpIHsgUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZnVuY3Rpb24odikgeyByZXNvbHZlKHsgdmFsdWU6IHYsIGRvbmU6IGQgfSk7IH0sIHJlamVjdCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWFrZVRlbXBsYXRlT2JqZWN0KGNvb2tlZCwgcmF3KSB7XHJcbiAgICBpZiAoT2JqZWN0LmRlZmluZVByb3BlcnR5KSB7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb29rZWQsIFwicmF3XCIsIHsgdmFsdWU6IHJhdyB9KTsgfSBlbHNlIHsgY29va2VkLnJhdyA9IHJhdzsgfVxyXG4gICAgcmV0dXJuIGNvb2tlZDtcclxufTtcclxuXHJcbnZhciBfX3NldE1vZHVsZURlZmF1bHQgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBcImRlZmF1bHRcIiwgeyBlbnVtZXJhYmxlOiB0cnVlLCB2YWx1ZTogdiB9KTtcclxufSkgOiBmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBvW1wiZGVmYXVsdFwiXSA9IHY7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnRTdGFyKG1vZCkge1xyXG4gICAgaWYgKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgcmV0dXJuIG1vZDtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgIGlmIChtb2QgIT0gbnVsbCkgZm9yICh2YXIgayBpbiBtb2QpIGlmIChrICE9PSBcImRlZmF1bHRcIiAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobW9kLCBrKSkgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcclxufVxyXG4iLCJpbXBvcnQgeyBBcHAsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgVEZpbGUsIFRBYnN0cmFjdEZpbGUsIFdvcmtzcGFjZUxlYWYsIG5vcm1hbGl6ZVBhdGgsIGRlYm91bmNlIH0gZnJvbSAnb2JzaWRpYW4nO1xuXG5kZWNsYXJlIG1vZHVsZSBcIm9ic2lkaWFuXCIge1xuICBpbnRlcmZhY2UgQXBwIHtcbiAgICBpbnRlcm5hbFBsdWdpbnM6IGFueVxuICB9XG4gIGludGVyZmFjZSBNZXRhZGF0YUNhY2hlIHtcbiAgICBvbkNsZWFuQ2FjaGU6IGFueVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEFjdGl2ZU5vdGVUaXRsZVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIC8vIEdldCB0aGUgd2luZG93IHRpdGxlXG4gIGJhc2VUaXRsZTogc3RyaW5nID0gZG9jdW1lbnQudGl0bGU7XG4gIGFwcFZlcjogc3RyaW5nO1xuICBzZXR0aW5nczogYW55O1xuXG4gIGFzeW5jIG9ubG9hZCgpIHtcbiAgICAvLyBTaG93IHRoZSBwbHVnaW4gaXMgbG9hZGluZyBmb3IgZGV2ZWxvcGVyc1xuICAgIGNvbnNvbGUubG9nKGBsb2FkaW5nICR7dGhpcy5tYW5pZmVzdC5pZH0gcGx1Z2luYCk7XG5cbiAgICAvLyBwYXJzZSB0aGUgdmVyc2lvbiBmcm9tIHRoZSBvcmlnaW5hbCB0aXRsZSBzdHJpbmdcbiAgICBpZiAodGhpcy5iYXNlVGl0bGUgPT0gJycgfHwgdGhpcy5iYXNlVGl0bGUgPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zb2xlLmxvZygnYmFzZVRpdGxlIGlzIHVuc2V0JylcbiAgICAgIHRoaXMuYmFzZVRpdGxlID0gJ09ic2lkaWFuJztcbiAgICB9XG4gICAgY29uc3QgbTogc3RyaW5nW10gPSB0aGlzLmJhc2VUaXRsZS5tYXRjaCgvdihbMC05Ll0rKSQvKTtcbiAgICB0aGlzLmFwcFZlciA9IG1bbS5sZW5ndGgtMV0gfHwgJyc7XG4gICAgLy9jb25zb2xlLmxvZyhgYXBwVmVyIHNldCB0byBbJHt0aGlzLmFwcFZlcn1dYCk7XG5cbiAgICAvLyBMb2FkIHRoZSBzZXR0aW5nc1xuICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG5cbiAgICAvLyBBZGQgdGhlIHNldHRpbmdzIHRhYlxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgQWN0aXZlTm90ZVRpdGxlUGx1Z2luU2V0dGluZ3NUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIC8vIFNldCB1cCBpbml0aWFsIHRpdGxlIGNoYW5nZVxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KHRoaXMuaW5pdGlhbGl6ZS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLnJlZnJlc2hUaXRsZSgpO1xuICAgIC8vdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5vbkNsZWFuQ2FjaGUodGhpcy5oYW5kbGVNZXRhLmJpbmQodGhpcykpO1xuICB9XG5cbiAgaW5pdGlhbGl6ZSgpIHtcbiAgICAvLyBjb25zb2xlLmxvZygncmVnaXN0ZXJpbmcgY2FsbGJhY2tzJyk7XG4gICAgLy8gV2hlbiBvcGVuaW5nLCByZW5hbWluZywgb3IgZGVsZXRpbmcgYSBmaWxlLCB1cGRhdGUgdGhlIHdpbmRvdyB0aXRsZVxuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC53b3Jrc3BhY2Uub24oJ2ZpbGUtb3BlbicsIHRoaXMuaGFuZGxlT3BlbikpO1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC53b3Jrc3BhY2Uub24oJ2FjdGl2ZS1sZWFmLWNoYW5nZScsIHRoaXMuaGFuZGxlTGVhZkNoYW5nZSkpO1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbigncmVuYW1lJywgdGhpcy5oYW5kbGVSZW5hbWUpKTtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oJ2RlbGV0ZScsIHRoaXMuaGFuZGxlRGVsZXRlKSk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUub24oJ2NoYW5nZWQnLCB0aGlzLmhhbmRsZU1ldGFDaGFuZ2UpKTtcbiAgICAvL3RoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLm9uKCdyZXNvbHZlJywgdGhpcy5oYW5kbGVNZXRhUmVzb2x2ZSkpO1xuICB9XG5cbiAgLy8gUmVzdG9yZSBvcmlnaW5hbCB0aXRsZSBvbiB1bmxvYWQuXG4gIG9udW5sb2FkKCkge1xuICAgIGNvbnNvbGUubG9nKGB1bmxvYWRpbmcgJHt0aGlzLm1hbmlmZXN0LmlkfSBwbHVnaW5gKTtcbiAgICAvL2NvbnNvbGUubG9nKGByZXZlcnRpbmcgdGl0bGUgdG8gJyR7dGhpcy5iYXNlVGl0bGV9J2ApO1xuICAgIGRvY3VtZW50LnRpdGxlID0gdGhpcy5iYXNlVGl0bGU7XG4gIH1cblxuICAvLyBEZWJvdW5jZWQgcmVmcmVzaFRpdGxlXG4gIGRlYm91bmNlZFJlZnJlc2hUaXRsZSA9IGRlYm91bmNlKChmaWxlPzogVEZpbGUpID0+IHtcbiAgICB0aGlzLnJlZnJlc2hUaXRsZShmaWxlKTtcbiAgfSwgNTAwLCBmYWxzZSk7XG5cbiAgLy8gVGhlIG1haW4gbWV0aG9kIHRoYXQgaXMgcmVzcG9uc2libGUgZm9yIHVwZGF0aW5nIHRoZSB0aXRsZVxuICByZWZyZXNoVGl0bGUoZmlsZT86IFRGaWxlKTogdm9pZCB7XG4gICAgbGV0IHRlbXBsYXRlOiBhbnk7XG4gICAgaWYgKCFmaWxlKSB7XG4gICAgICBmaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKSB8fCB1bmRlZmluZWQ7XG4gICAgfVxuICAgIC8vIEZvciB0aGUgdGVtcGxhdGUsIHRoZSB2YXVsdCBhbmQgd29ya3NwYWNlIGFyZSBhbHdheXMgYXZhaWxhYmxlXG4gICAgdGVtcGxhdGUgPSB7XG4gICAgICAndmF1bHQnOiB0aGlzLmFwcC52YXVsdC5nZXROYW1lKCksXG4gICAgICAndmVyc2lvbic6ICh0aGlzLmFwcFZlciB8fCAnJyksXG4gICAgICAnd29ya3NwYWNlJzogdGhpcy5hcHAuaW50ZXJuYWxQbHVnaW5zLnBsdWdpbnMud29ya3NwYWNlcy5pbnN0YW5jZS5hY3RpdmVXb3Jrc3BhY2UgLy8gRGVmYXVsdHMgdG86ICcnIGlmIG5vdCBlbmFibGVkXG4gICAgfTtcbiAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICAvLyBJZiBhIGZpbGUgaXMgb3BlbiwgdGhlIGZpbGVuYW1lLCBwYXRoIGFuZCBmcm9udG1hdHRlciBpcyBhZGRlZFxuICAgICAgbGV0IGNhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XG4gICAgICBpZiAoY2FjaGUgJiYgY2FjaGUuZnJvbnRtYXR0ZXIpIHtcbiAgICAgICAgY29uc3QgaXNUZW1wbGF0ZSA9IG5ldyBSZWdFeHAoJzwlJyk7XG4gICAgICAgIGZvciAoY29uc3QgW2Zyb250bWF0dGVyS2V5LCBmcm9udG1hdHRlclZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhjYWNoZS5mcm9udG1hdHRlciB8fCB7fSkpIHtcbiAgICAgICAgICBsZXQgayA9ICgnZnJvbnRtYXR0ZXIuJyArIGZyb250bWF0dGVyS2V5KSBhcyBzdHJpbmc7XG4gICAgICAgICAgaWYgKCFpc1RlbXBsYXRlLnRlc3QoZnJvbnRtYXR0ZXJWYWx1ZSkpIHtcbiAgICAgICAgICAgIHRlbXBsYXRlW2tdID0gZnJvbnRtYXR0ZXJWYWx1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldCBmcmllbmRseUJhc2VuYW1lOiBzdHJpbmcgPSBmaWxlLmJhc2VuYW1lO1xuICAgICAgaWYgKGZpbGUuZXh0ZW5zaW9uICE9PSAnbWQnKSB7XG4gICAgICAgIGZyaWVuZGx5QmFzZW5hbWUgPSBmaWxlLm5hbWU7XG4gICAgICB9XG4gICAgICB0ZW1wbGF0ZSA9IHtcbiAgICAgICAgJ2ZpbGVwYXRoJzogZmlsZS5wYXRoLFxuICAgICAgICAnZmlsZW5hbWUnOiBmaWxlLm5hbWUsXG4gICAgICAgICdiYXNlbmFtZSc6IGZyaWVuZGx5QmFzZW5hbWUsXG4gICAgICAgICdleHRlbnNpb24nOiBmaWxlLmV4dGVuc2lvbixcbiAgICAgICAgLi4udGVtcGxhdGVcbiAgICAgIH1cbiAgICAgIC8vY29uc29sZS5sb2codGVtcGxhdGUpXG4gICAgICBkb2N1bWVudC50aXRsZSA9IHRoaXMudGVtcGxhdGVUaXRsZSh0ZW1wbGF0ZSwgdGhpcy5zZXR0aW5ncy50aXRsZVRlbXBsYXRlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZG9jdW1lbnQudGl0bGUgPSB0aGlzLnRlbXBsYXRlVGl0bGUodGVtcGxhdGUsIHRoaXMuc2V0dGluZ3MudGl0bGVUZW1wbGF0ZUVtcHR5KTtcbiAgICB9XG4gIH1cblxuICB0ZW1wbGF0ZVRpdGxlKHRlbXBsYXRlOiBhbnksIHRpdGxlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGxldCBkZWxpbVN0ciA9IHRoaXMuc2V0dGluZ3MuZGVsaW1TdHI7XG4gICAgbGV0IHRpdGxlU2VwYXJhdG9yID0gdGhpcy5zZXR0aW5ncy50aXRsZVNlcGFyYXRvcjtcbiAgICBpZiAodGhpcy5zZXR0aW5ncy5vdmVycmlkZVlhbWxGaWVsZCAhPT0gbnVsbCAmJiB0aGlzLnNldHRpbmdzLm92ZXJyaWRlWWFtbEZpZWxkLmxlbmd0aCA+IDApIHtcbiAgICAgIGxldCB0aXRsZU92ZXJyaWRlID0gU3RyaW5nKCdmcm9udG1hdHRlci4nICsgdGhpcy5zZXR0aW5ncy5vdmVycmlkZVlhbWxGaWVsZCk7XG4gICAgICBpZiAodGVtcGxhdGVbdGl0bGVPdmVycmlkZV0pIHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ292ZXJyaWRlIHRpdGxlOiAlcycsIHRlbXBsYXRlW3RpdGxlT3ZlcnJpZGVdKTtcbiAgICAgICAgcmV0dXJuIHRlbXBsYXRlW3RpdGxlT3ZlcnJpZGVdO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBQcm9jZXNzIGVhY2ggdGVtcGxhdGUga2V5XG4gICAgT2JqZWN0LmtleXModGVtcGxhdGUpLmZvckVhY2goZmllbGQgPT4ge1xuICAgICAgY29uc3QgaGFzRmllbGQgPSBuZXcgUmVnRXhwKGB7eyR7ZmllbGR9fX1gKTtcbiAgICAgIC8vY29uc29sZS5sb2coYCVjY2hlY2tpbmcgaWYgJHt0aXRsZX0gY29udGFpbnMge3ske2ZpZWxkfX19YCwgJ2JhY2tncm91bmQ6ICMyMjI7IGNvbG9yOiAjYTBmZmZmJyk7XG4gICAgICAvL2NvbnNvbGUubG9nKCdib29sOiAnICsgaGFzRmllbGQudGVzdCh0aXRsZSkpO1xuICAgICAgLy9jb25zb2xlLmxvZygndHlwZSBvZiBmaWVsZDogJyArIHR5cGVvZihmaWVsZCkpO1xuICAgICAgLy9jb25zb2xlLmxvZyhgdmFsOiBbJHt0ZW1wbGF0ZVtmaWVsZF19XWApO1xuICAgICAgaWYgKGhhc0ZpZWxkLnRlc3QodGl0bGUpICYmIHRlbXBsYXRlW2ZpZWxkXSAhPT0gbnVsbCAmJiBTdHJpbmcodGVtcGxhdGVbZmllbGRdKS5sZW5ndGggPiAwKSB7XG4gICAgICAgIC8vY29uc29sZS5sb2coYCVjZXhlY3V0aW5nIHRyYW5zZm9ybXM6IFske2ZpZWxkfV0gLS0+IFske3RlbXBsYXRlW2ZpZWxkXX1dYCwgJ2JhY2tncm91bmQ6ICMyMjI7IGNvbG9yOiAjYmFkYTU1Jyk7XG4gICAgICAgIGxldCByZSA9IG5ldyBSZWdFeHAoYHt7JHtmaWVsZH19fWApO1xuICAgICAgICB0aXRsZSA9IHRpdGxlLnJlcGxhY2UocmUsIGAke3RlbXBsYXRlW2ZpZWxkXX1gKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyBjbGVhbiB1cCBkZWxpbWl0ZXJzXG4gICAgbGV0IHJlID0gLyhbKF0rKT97e1tefV0rfX0oWyldKyk/L2c7XG4gICAgdGl0bGUgPSB0aXRsZS5yZXBsYWNlKHJlLCAnJyk7XG4gICAgLy8gY2xlYW4gdXAgZGVsaW1pdGVyc1xuICAgIGNvbnN0IHJlcGxhY2VtZW50cyA9IG5ldyBNYXAoW1xuICAgICAgW2BeJHtkZWxpbVN0cn1gLCAnJ10sXG4gICAgICBbYCR7ZGVsaW1TdHJ9K2AsIGRlbGltU3RyXSxcbiAgICAgIFtgJHtkZWxpbVN0cn0oPyFcXCApYCwgdGl0bGVTZXBhcmF0b3JdLFxuICAgICAgW2AoPzwhXFwgKSR7ZGVsaW1TdHJ9YCwgJyddLFxuICAgIF0pO1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIHJlcGxhY2VtZW50cykge1xuICAgICAgbGV0IHJlID0gbmV3IFJlZ0V4cChrZXksICdnJyk7XG4gICAgICB0aXRsZSA9IHRpdGxlLnJlcGxhY2UocmUsIHZhbHVlKTtcbiAgICB9XG4gICAgcmV0dXJuIHRpdGxlO1xuICB9O1xuXG4gIHByaXZhdGUgcmVhZG9ubHkgaGFuZGxlUmVuYW1lID0gYXN5bmMgKGZpbGU6IFRGaWxlLCBvbGRQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAvLyBjb25zb2xlLmxvZyhgZmlsZTogJHtvbGRQYXRofSByZW5hbWVkIHRvOiAke2ZpbGUucGF0aH1gKTtcbiAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlICYmIGZpbGUgPT09IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCkpIHtcbiAgICAgIHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUub25DbGVhbkNhY2hlKCgpID0+IHsgdGhpcy5yZWZyZXNoVGl0bGUoZmlsZSk7IH0pO1xuICAgIH1cbiAgfTtcblxuICBwcml2YXRlIHJlYWRvbmx5IGhhbmRsZURlbGV0ZSA9IGFzeW5jIChmaWxlOiBURmlsZSk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgIHRoaXMucmVmcmVzaFRpdGxlKCk7XG4gIH07XG5cbiAgcHJpdmF0ZSByZWFkb25seSBoYW5kbGVPcGVuID0gYXN5bmMgKGZpbGU6IFRGaWxlKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSAmJiBmaWxlID09PSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpKSB7XG4gICAgICB0aGlzLmRlYm91bmNlZFJlZnJlc2hUaXRsZShmaWxlKTtcbiAgICB9XG4gIH07XG5cbiAgcHJpdmF0ZSByZWFkb25seSBoYW5kbGVMZWFmQ2hhbmdlID0gYXN5bmMgKGxlYWY6IFdvcmtzcGFjZUxlYWYgfCBudWxsKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgdGhpcy5kZWJvdW5jZWRSZWZyZXNoVGl0bGUoKTtcbiAgfTtcblxuICBwcml2YXRlIHJlYWRvbmx5IGhhbmRsZU1ldGFDaGFuZ2UgPSBhc3luYyAoZmlsZTogVEZpbGUpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlICYmIGZpbGUgPT09IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCkpIHtcbiAgICAgIHRoaXMucmVmcmVzaFRpdGxlKGZpbGUpO1xuICAgIH1cbiAgfTtcblxuICBwcml2YXRlIHJlYWRvbmx5IGhhbmRsZU1ldGFSZXNvbHZlID0gYXN5bmMgKGZpbGU6IFRGaWxlKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSAmJiBmaWxlID09PSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpKSB7XG4gICAgICB0aGlzLnJlZnJlc2hUaXRsZShmaWxlKTtcbiAgICB9XG4gIH07XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cblxufVxuXG5pbnRlcmZhY2UgQWN0aXZlTm90ZVRpdGxlUGx1Z2luU2V0dGluZ3Mge1xuICB0aXRsZVRlbXBsYXRlOiBzdHJpbmcsXG4gIHRpdGxlVGVtcGxhdGVFbXB0eTogc3RyaW5nLFxuICB0aXRsZVNlcGFyYXRvcjogc3RyaW5nLFxuICBkZWxpbVN0cjogc3RyaW5nLFxuICBvdmVycmlkZVlhbWxGaWVsZDogc3RyaW5nXG59XG5cbmNvbnN0IERFRkFVTFRfU0VUVElOR1M6IEFjdGl2ZU5vdGVUaXRsZVBsdWdpblNldHRpbmdzID0ge1xuICB0aXRsZVRlbXBsYXRlOiBcInt7YmFzZW5hbWV9fX5+e3t2YXVsdH19IC0gT2JzaWRpYW4gdnt7dmVyc2lvbn19XCIsXG4gIHRpdGxlVGVtcGxhdGVFbXB0eTogXCJ7e3ZhdWx0fX0gLSBPYnNpZGlhbiB2e3t2ZXJzaW9ufX1cIixcbiAgdGl0bGVTZXBhcmF0b3I6IFwiIC0gXCIsXG4gIGRlbGltU3RyOiBcIn5+XCIsXG4gIG92ZXJyaWRlWWFtbEZpZWxkOiBcInRpdGxlXCJcbn1cblxuY2xhc3MgQWN0aXZlTm90ZVRpdGxlUGx1Z2luU2V0dGluZ3NUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcblxuICBwbHVnaW46IEFjdGl2ZU5vdGVUaXRsZVBsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBBY3RpdmVOb3RlVGl0bGVQbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGxldCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuICAgIGxldCBkZXNjOiBEb2N1bWVudEZyYWdtZW50O1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoJ2gyJywge3RleHQ6ICdXaW5kb3cgdGl0bGUgdGVtcGxhdGVzJ30pO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdwJywge3RleHQ6ICdUaGVzZSB0d28gdGVtcGxhdGVzIG92ZXJyaWRlIHRoZSB3aW5kb3cgdGl0bGUgb2YgdGhlIE9ic2lkaWFuIHdpbmRvdy4gVGhpcyBpcyB1c2VmdWwgZm9yIGV4YW1wbGUgd2hlbiB5b3UgdXNlIHRyYWNraW5nIHNvZnR3YXJlIHRoYXQgd29ya3Mgd2l0aCB3aW5kb3cgdGl0bGVzLiBZb3UgY2FuIHVzZSB0aGUgZm9ybWF0IGB+fnt7cGxhY2Vob2xkZXJ9fX5+YCBpZiB5b3Ugd2FudCB0aGUgcGxhY2Vob2xkZXIgdG8gYmUgY29tcGxldGVseSBvbWl0dGVkIHdoZW4gYmxhbmssIG90aGVyd2lzZSB3aGl0ZXNwYWNlIGFuZCBvdGhlciBjaGFyYWN0ZXJzIHdpbGwgYmUgcHJlc2VydmVkLiBZb3UgY2FuIHN1cnJvdW5kIGEgcGxhY2Vob2xkZXIgd2l0aCBwYXJlbnRoZXNlcyBlLmcuIGAoe3tmcm9udG1hdHRlci5wcm9qZWN0fX0pYCBhbmQgaXQgd2lsbCBiZSBoaWRkZW4gaWYgdGhlIHJlZmVyZW5jZWQgZmllbGQgaXMgZW1wdHkuJ30pO1xuXG4gICAgZGVzYyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICBkZXNjLmFwcGVuZCgnQXZhaWxhYmxlICcpO1xuICAgIGRlc2MuY3JlYXRlRWwoJ2InKS5pbm5lclRleHQgPSAncGxhY2Vob2xkZXJzOic7XG4gICAgbGV0IHBsYWNlaG9sZGVycyA9IFtcbiAgICAgIFsgXCJ2YXVsdFwiLCBcIndvcmtzcGFjZVwiLCBcInZlcnNpb25cIiBdLFxuICAgICAgWyBcImZpbGVuYW1lXCIsIFwiZmlsZXBhdGhcIiwgXCJiYXNlbmFtZVwiLCBcImV4dGVuc2lvblwiIF0sXG4gICAgICBbIFwiZnJvbnRtYXR0ZXIuPGFueV9mcm9udG1hdHRlcl9rZXk+XCIgXVxuICAgIF1cbiAgICBwbGFjZWhvbGRlcnMuZm9yRWFjaChyb3cgPT4ge1xuICAgICAgZGVzYy5jcmVhdGVFbChcImJyXCIpXG4gICAgICByb3cuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgICBkZXNjLmFwcGVuZChge3ske2tleX19fSBgKVxuICAgICAgfSlcbiAgICB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ0RlZmF1bHQgVGVtcGxhdGUnKVxuICAgICAgLnNldERlc2MoZGVzYylcbiAgICAgIC5hZGRUZXh0KHRleHQgPT4ge1xuICAgICAgICB0ZXh0LmlucHV0RWwuc3R5bGUuZm9udEZhbWlseSA9ICdtb25vc3BhY2UnO1xuICAgICAgICB0ZXh0LmlucHV0RWwuc3R5bGUud2lkdGggPSAnNTAwcHgnO1xuICAgICAgICB0ZXh0LmlucHV0RWwuc3R5bGUuaGVpZ2h0ID0gJzQ2cHgnO1xuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKERFRkFVTFRfU0VUVElOR1MudGl0bGVUZW1wbGF0ZSlcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MudGl0bGVUZW1wbGF0ZSlcbiAgICAgICAgICAub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy50aXRsZVRlbXBsYXRlID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zYXZlRGF0YSh0aGlzLnBsdWdpbi5zZXR0aW5ncyk7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5yZWZyZXNoVGl0bGUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnWUFNTCBGcm9udG1hdHRlciBUaXRsZSBPdmVycmlkZSBGaWVsZCcpXG4gICAgICAuc2V0RGVzYygnSWYgdGhpcyBmcm9udG1hdHRlciBmaWVsZCBpcyBwcmVzZW50LCB1c2UgaXRzIHZhbHVlIGFzIHRoZSB0aXRsZSBpbnN0ZWFkIG9mIGR5bmFtaWNhbGx5IGNhbGN1bGF0aW5nIGl0LicpXG4gICAgICAuYWRkVGV4dCh0ZXh0ID0+IHtcbiAgICAgICAgdGV4dC5pbnB1dEVsLnN0eWxlLmZvbnRGYW1pbHkgPSAnbW9ub3NwYWNlJztcbiAgICAgICAgdGV4dC5pbnB1dEVsLnN0eWxlLndpZHRoID0gJzUwMHB4JztcbiAgICAgICAgdGV4dC5pbnB1dEVsLnN0eWxlLmhlaWdodCA9ICc0NnB4JztcbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihERUZBVUxUX1NFVFRJTkdTLm92ZXJyaWRlWWFtbEZpZWxkKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5vdmVycmlkZVlhbWxGaWVsZClcbiAgICAgICAgICAub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5vdmVycmlkZVlhbWxGaWVsZCA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2F2ZURhdGEodGhpcy5wbHVnaW4uc2V0dGluZ3MpO1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4ucmVmcmVzaFRpdGxlKCk7XG4gICAgICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBkZXNjID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgIGRlc2MuYXBwZW5kKCdBdmFpbGFibGUgJyk7XG4gICAgZGVzYy5jcmVhdGVFbCgnYicpLmlubmVyVGV4dCA9ICdwbGFjZWhvbGRlcnM6JztcbiAgICBwbGFjZWhvbGRlcnMgPSBbXG4gICAgICBbIFwidmF1bHRcIiwgXCJ3b3Jrc3BhY2VcIiwgXCJ2ZXJzaW9uXCIgXSxcbiAgICBdXG4gICAgcGxhY2Vob2xkZXJzLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIGRlc2MuY3JlYXRlRWwoXCJiclwiKVxuICAgICAgZGVzYy5hcHBlbmQoYHt7JHtrZXl9fX1gKVxuICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnVGVtcGxhdGUgZm9yIHdoZW4gbm8gZmlsZSBpcyBvcGVuJylcbiAgICAgIC5zZXREZXNjKGRlc2MpXG4gICAgICAuYWRkVGV4dCh0ZXh0ID0+IHtcbiAgICAgICAgdGV4dC5pbnB1dEVsLnN0eWxlLmZvbnRGYW1pbHkgPSAnbW9ub3NwYWNlJztcbiAgICAgICAgdGV4dC5pbnB1dEVsLnN0eWxlLndpZHRoID0gJzUwMHB4JztcbiAgICAgICAgdGV4dC5pbnB1dEVsLnN0eWxlLmhlaWdodCA9ICc0NnB4JztcbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihERUZBVUxUX1NFVFRJTkdTLnRpdGxlVGVtcGxhdGVFbXB0eSlcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MudGl0bGVUZW1wbGF0ZUVtcHR5KVxuICAgICAgICAgIC5vbkNoYW5nZSgodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnRpdGxlVGVtcGxhdGVFbXB0eSA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2F2ZURhdGEodGhpcy5wbHVnaW4uc2V0dGluZ3MpO1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4ucmVmcmVzaFRpdGxlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnU2VwYXJhdG9yIHRvIGluc2VydCBiZXR3ZWVuIHBsYWNlaG9sZGVyIGVsZW1lbnRzJylcbiAgICAgIC5zZXREZXNjKCdSZXBsYWNlcyBkZWxpbWl0ZXIgc3RyaW5nIGJldHdlZW4gcGxhY2Vob2xkZXJzIHRoYXQgYXJlIG5vdCBudWxsLicpXG4gICAgICAuYWRkVGV4dCh0ZXh0ID0+IHtcbiAgICAgICAgdGV4dC5pbnB1dEVsLnN0eWxlLmZvbnRGYW1pbHkgPSAnbW9ub3NwYWNlJztcbiAgICAgICAgdGV4dC5pbnB1dEVsLnN0eWxlLndpZHRoID0gJzE0MnB4JztcbiAgICAgICAgdGV4dC5pbnB1dEVsLnN0eWxlLmhlaWdodCA9ICc0NnB4JztcbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignIC0gJylcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MudGl0bGVTZXBhcmF0b3IpXG4gICAgICAgICAgLm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MudGl0bGVTZXBhcmF0b3IgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNhdmVEYXRhKHRoaXMucGx1Z2luLnNldHRpbmdzKTtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnJlZnJlc2hUaXRsZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ0RlbGltaXRlciBzdHJpbmcnKVxuICAgICAgLnNldERlc2MoJ1NlbGVjdCBhIHN0cmluZyB0byBiZSB1c2VkIHRvIG1hcmsgbG9jYXRpb25zIGZvciBzZXBhcmF0b3JzIHRvIGJlIGluc2VydGVkLicpXG4gICAgICAuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XG4gICAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbignfn4nLCAnfn4gKFRpbGRlKScpO1xuICAgICAgICBkcm9wZG93bi5hZGRPcHRpb24oJyMjJywgJyMjIChIYXNoKScpO1xuICAgICAgICBkcm9wZG93bi5hZGRPcHRpb24oJ19fJywgJ19fIChVbmRlcnNjb3JlKScpO1xuICAgICAgICBkcm9wZG93bi5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWxpbVN0cik7XG4gICAgICAgIGRyb3Bkb3duLm9uQ2hhbmdlKChvcHRpb24pID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWxpbVN0ciA9IG9wdGlvbjtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zYXZlRGF0YSh0aGlzLnBsdWdpbi5zZXR0aW5ncyk7XG4gICAgICAgICAgdGhpcy5wbHVnaW4ucmVmcmVzaFRpdGxlKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgfVxufVxuIl0sIm5hbWVzIjpbIlBsdWdpbiIsImRlYm91bmNlIiwiVEZpbGUiLCJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUF1REE7QUFDTyxTQUFTLFNBQVMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUU7QUFDN0QsSUFBSSxTQUFTLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxPQUFPLEtBQUssWUFBWSxDQUFDLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLFVBQVUsT0FBTyxFQUFFLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUU7QUFDaEgsSUFBSSxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUMsRUFBRSxVQUFVLE9BQU8sRUFBRSxNQUFNLEVBQUU7QUFDL0QsUUFBUSxTQUFTLFNBQVMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0FBQ25HLFFBQVEsU0FBUyxRQUFRLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0FBQ3RHLFFBQVEsU0FBUyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsTUFBTSxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQyxFQUFFO0FBQ3RILFFBQVEsSUFBSSxDQUFDLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLFVBQVUsSUFBSSxFQUFFLENBQUMsRUFBRSxJQUFJLEVB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
