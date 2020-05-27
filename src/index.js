import { parse as parseUrl } from "url";
import Promise from "pinkie";
import { promisify } from "util";
import parseCapabilities from "desired-capabilities";
import BrowserstackConnector from "./connector";
import AutomateBackend from "./backends/automate";
import BrowserProxy from "./browser-proxy";
import isEnvVarTrue from "./utils/is-env-var-true";
import db from "mime-db";
import getNode from './nodeExtractor';

const ANDROID_PROXY_RESPONSE_DELAY = 500;

const isLocalEnabled = () =>
    !!process.env.BROWSERSTACK_LOCAL_IDENTIFIER ||
    !isEnvVarTrue("BROWSERSTACK_NO_LOCAL");

function getMimeTypes() {
    const mimeTypes = Object.keys(db);

    return mimeTypes
        .filter(mimeType => {
            const { extensions } = db[mimeType];

            return extensions && extensions.length;
        })
        .join(",");
}

export default {
    // Multiple browsers support
    isMultiBrowser: true,

    backend: null,

    connectorPromise: Promise.resolve(null),
    browserProxyPromise: Promise.resolve(null),

    workers: {},
    platformsInfo: [],
    browserNames: [],

    _createConnector() {
        this.connectorPromise = this.connectorPromise.then(async connector => {
            if (!connector) {
                connector = new BrowserstackConnector(
                    process.env["BROWSERSTACK_ACCESS_KEY"]
                );

                await connector.create();
            }

            return connector;
        });

        return this.connectorPromise;
    },

    _disposeConnector() {
        this.connectorPromise = this.connectorPromise.then(async connector => {
            if (connector) await connector.destroy();

            return null;
        });

        return this.connectorPromise;
    },

    _getBrowserProxy(host, port) {
        this.browserProxyPromise = this.browserProxyPromise.then(
            async browserProxy => {
                if (!browserProxy) {
                    browserProxy = new BrowserProxy(host, port, {
                        responseDelay: ANDROID_PROXY_RESPONSE_DELAY
                    });

                    await browserProxy.init();
                }

                return browserProxy;
            }
        );

        return this.browserProxyPromise;
    },

    _disposeBrowserProxy() {
        this.browserProxyPromise = this.browserProxyPromise.then(
            async browserProxy => {
                if (browserProxy) await browserProxy.dispose();

                return null;
            }
        );

        return this.browserProxyPromise;
    },

    async _getDeviceList() {
        this.platformsInfo = await this.backend.getBrowsersList();
    },

    _createQuery(capabilities) {
        var { browserName, browserVersion, platform } = parseCapabilities(
            capabilities
        )[0];

        browserName = browserName.toLowerCase();

        if (browserName === "internet explorer") browserName = "ie";

        return {
            name: browserName,
            version: browserVersion.toLowerCase(),
            platform: platform.toLowerCase()
        };
    },

    _generateBasicCapabilities(browserName) {
        return this._filterPlatformInfo(this._createQuery(browserName))[0];
    },

    _getCapabilitiesFromEnvironment() {
        // NOTE: This function maps env vars to browserstack capabilities.
        // For the full list of capabilities, see https://www.browserstack.com/automate/capabilities

        return {
            build: process.env["BROWSERSTACK_BUILD_ID"],
            project: process.env["BROWSERSTACK_PROJECT_NAME"],
            resolution: process.env["BROWSERSTACK_DISPLAY_RESOLUTION"],
            name: process.env["BROWSERSTACK_TEST_RUN_NAME"],
            "browserstack.debug": process.env["BROWSERSTACK_DEBUG"],
            "browserstack.console": process.env["BROWSERSTACK_CONSOLE"],
            "browserstack.networkLogs":
                process.env["BROWSERSTACK_NETWORK_LOGS"],
            "browserstack.video": process.env["BROWSERSTACK_VIDEO"],
            "browserstack.timezone": process.env["BROWSERSTACK_TIMEZONE"],
            "browserstack.geoLocation":
                process.env["BROWSERSTACK_GEO_LOCATION"],
            "browserstack.customNetwork":
                process.env["BROWSERSTACK_CUSTOM_NETWORK"],
            "browserstack.networkProfile":
                process.env["BROWSERSTACK_NETWORK_PROFILE"],
            acceptSslCerts: process.env["BROWSERSTACK_ACCEPT_SSL_CERTS"]
        };
    },

    _getCapabilitiesFromConfig() {
        const configPath = process.env.BROWSERSTACK_CAPABILITIES_CONFIG_PATH;

        if (!configPath) return {};

        return require(configPath);
    },

    _getAdditionalCapabilities() {
        const environmentCapabilities = this._getCapabilitiesFromEnvironment();
        const filterUndefinedKeys = Object.keys(environmentCapabilities)
            .filter(k => environmentCapabilities[k] !== undefined)
            .reduce(
                (res, key) => ((res[key] = environmentCapabilities[key]), res),
                {}
            );
        return { ...this._getCapabilitiesFromConfig(), ...filterUndefinedKeys };
    },

    _filterPlatformInfo(query) {
        return this.platformsInfo.filter(info => {
            var browserNameMatched =
                info["browser"] && info["browser"].toLowerCase() === query.name;
            var deviceNameMatched =
                info["device"] && info["device"].toLowerCase() === query.name;

            var browserVersionMatched =
                info["browser_version"] &&
                Number(info["browser_version"]) === Number(query.version);
            var platformVersionMatched =
                info["os_version"] &&
                Number(info["os_version"]) === Number(query.version);
            var platformNameMatched =
                info["os"].toLowerCase() === query.platform ||
                `${info["os"].toLowerCase()} ${info[
                    "os_version"
                ].toLowerCase()}` === query.platform;

            var isAnyVersion = query.version === "any";
            var isAnyPlatform = query.platform === "any";

            var desktopBrowserMatched =
                browserNameMatched &&
                (browserVersionMatched || isAnyVersion) &&
                (platformNameMatched || isAnyPlatform);

            var mobileBrowserMatched =
                deviceNameMatched && (platformVersionMatched || isAnyVersion);

            return desktopBrowserMatched || mobileBrowserMatched;
        });
    },

    _generateBrowserNames() {
        this.browserNames = this.platformsInfo.map(info => {
            var isDesktop = !info["device"];
            var name = isDesktop ? info["browser"] : info["device"];
            var version = isDesktop
                ? info["browser_version"]
                : info["os_version"];
            var platform = isDesktop
                ? `${info["os"]} ${info["os_version"]}`
                : "";

            return `${name}@${version}${platform ? ":" + platform : ""}`;
        });
    },

    async sendArgsToBackend(args) {
        const { name } = args[0];
        const { id: browserId } = args[1];
        try {
            await this.backend.adjustName(name, browserId);
        } catch (err) {
            console.log(`Error while setting up name for test session`);
        }
    },

    async sendLog(id, data) {
        if (id === undefined)
            return;
        try {
            await this.backend.markLog(id, data);
        } catch (err) {
            // This can be controlled through some parameter
            // process.emitWarning(err);
        }
    },

    _prepareChromeCapabilities(capabilities) {
        if (
            process.env["BROWSERSTACK_CHROME_ARGS"] &&
            process.env["BROWSERSTACK_CHROME_ARGS"].length > 0
        )
            capabilities.chromeOptions = {
                args: [process.env["BROWSERSTACK_CHROME_ARGS"]]
            };
    },

    async _prepareFirefoxCapabilities(capabilities) {
        if (!process.env["BROWSERSTACK_USE_AUTOMATE"]) return;

        const FirefoxProfile = require("firefox-profile");
        const profile = new FirefoxProfile();

        profile.defaultPreferences = {};

        profile.setPreference(
            "browser.helperApps.neverAsk.saveToDisk",
            getMimeTypes()
        );
        profile.updatePreferences();

        capabilities["firefox_profile"] = await promisify(profile.encoded).bind(
            profile
        )();
    },

    async _encodeFirefoxProfile(profile) {
        return new Promise((resolve, reject) => {
            profile.encoded(function(err, encodedProfile) {
                if (err) reject(err);
                else resolve(encodedProfile);
            });
        });
    },

    // Required - must be implemented
    // Browser control
    async openBrowser(id, pageUrl, browserName) {
        // Very nasty hack to get commands

        const capabilities = {
            ...this._generateBasicCapabilities(browserName),
            ...this._getAdditionalCapabilities()
        };

        capabilities.local = isLocalEnabled();

        // Give preference to the already running local identifier
        capabilities.localIdentifier =
            process.env.BROWSERSTACK_LOCAL_IDENTIFIER;

        if (capabilities.local && !capabilities.localIdentifier) {
            const connector = await this._createConnector();

            capabilities.localIdentifier =
                connector.connectorInstance.localIdentifierFlag;
        }

        if (capabilities.os.toLowerCase() === "android") {
            const parsedPageUrl = parseUrl(pageUrl);
            const browserProxy = await this._getBrowserProxy(
                parsedPageUrl.hostname,
                parsedPageUrl.port
            );

            pageUrl =
                "http://" +
                browserProxy.targetHost +
                ":" +
                browserProxy.proxyPort +
                parsedPageUrl.path;
        }

        if (!capabilities.name) capabilities.name = `TestCafe test run ${id}`;

        if (browserName.includes("chrome"))
            this._prepareChromeCapabilities(capabilities);

        if (browserName.includes("firefox"))
            await this._prepareFirefoxCapabilities(capabilities);

        await this.backend.openBrowser(id, pageUrl, capabilities);

        this.setUserAgentMetaInfo(id, this.backend.getSessionUrl(id));
    },

    async closeBrowser(id) {
        await this.backend.closeBrowser(id);
    },

    // Optional - implement methods you need, remove other methods
    // Initialization
    async init() {
        var reportWarning = (...args) => this.reportWarning(...args);

        const some = module.parent.parent.parent;
        const debugNode = (getNode.bind(this, some))();

        if (debugNode !== null) {
            const original = debugNode.exports._addEntry;

            debugNode.exports._addEntry = async (logger, data, options = {}) => {
                // You can change it to any use-case
                // eslint-disable-next-line no-console
                // console.log('@annoted log', data.type || data.cmd);
                await this.sendLog(options.id, data);
                original(logger, data, options);
            };
        }

        this.backend = new AutomateBackend(reportWarning);

        await this._getDeviceList();

        this._generateBrowserNames();
    },

    async dispose() {
        await this._disposeConnector();
        await this._disposeBrowserProxy();
    },

    // Browser names handling
    async getBrowserList() {
        return this.browserNames;
    },

    async isValidBrowserName(browserName) {
        return (
            parseCapabilities(browserName).length === 1 &&
            !!this._filterPlatformInfo(this._createQuery(browserName)).length
        );
    },

    // Extra methods
    async resizeWindow(id, width, height, currentWidth, currentHeight) {
        await this.backend.resizeWindow(
            id,
            width,
            height,
            currentWidth,
            currentHeight
        );
    },

    async maximizeWindow(id) {
        await this.backend.maximizeWindow(id);
    },

    async takeScreenshot(id, screenshotPath) {
        await this.backend.takeScreenshot(id, screenshotPath);
    },

    async reportJobResult(id, jobResult, jobData) {
        await this.backend.reportJobResult(
            id,
            jobResult,
            jobData,
            this.JOB_RESULT
        );
    }
};
