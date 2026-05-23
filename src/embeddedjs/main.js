import Poco from "commodetto/Poco";
import parseBMF from "commodetto/parseBMF";
import parseRLE from "commodetto/parseRLE";
import Location from "embedded:sensor/Location";
import Health from "embedded:sensor/Health";
import Message from "pebble/message";

const render = new Poco(screen);

// Load a custom font from BMF resources
function getFont(name, size) {
    const font = parseBMF(new Resource(`${name}-${size}.fnt`));
    font.bitmap = parseRLE(new Resource(`${name}-${size}-alpha.bm4`));
    return font;
}

// Fonts
const timeFont = getFont("artemis_inter", 56);
const dateFont = getFont("artemis_inter", 24);
const smallFont = new render.Font("Gothic-Regular", 18);

// Default settings
const DEFAULT_SETTINGS = {
    backgroundColor: { r: 0, g: 0, b: 0 },
    textColor: { r: 255, g: 255, b: 255 },
    useFahrenheit: false,
    showDate: true,
    use24Hour: true
};

// Load settings from persistent storage
function loadSettings() {
    const stored = localStorage.getItem("settings");
    if (stored) {
        try {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        } catch (e) {
            console.log("Failed to parse settings");
        }
    }
    return { ...DEFAULT_SETTINGS };
}

// Save settings to persistent storage
function saveSettings() {
    localStorage.setItem("settings", JSON.stringify(settings));
}

let settings = loadSettings();

// Create colors from settings
let bgColor = render.makeColor(settings.backgroundColor.r,
    settings.backgroundColor.g, settings.backgroundColor.b);
let textColor = render.makeColor(settings.textColor.r,
    settings.textColor.g, settings.textColor.b);

function updateColors() {
    bgColor = render.makeColor(settings.backgroundColor.r,
        settings.backgroundColor.g, settings.backgroundColor.b);
    textColor = render.makeColor(settings.textColor.r,
        settings.textColor.g, settings.textColor.b);
}

// Day and month names
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Store latest time for redraws triggered by other events
let lastDate = new Date();

// Weather data
let weather = null;

// Steps data
let steps = 0;
const health = new Health();

function updateSteps() {
    health.read((sample) => {
        if (sample && sample.steps !== undefined) {
            steps = sample.steps;
            drawScreen();
        }
    }, { metric: "steps", period: "day" });
}

// Map Open-Meteo weather codes to descriptions
function getWeatherDescription(code) {
    if (code === 0) return "Clear";
    if (code <= 3) return "Cloudy";
    if (code <= 48) return "Fog";
    if (code <= 55) return "Drizzle";
    if (code <= 57) return "Fz. Drizzle";
    if (code <= 65) return "Rain";
    if (code <= 67) return "Fz. Rain";
    if (code <= 75) return "Snow";
    if (code <= 77) return "Snow Grains";
    if (code <= 82) return "Showers";
    if (code <= 86) return "Snow Shwrs";
    if (code === 95) return "T-Storm";
    if (code <= 99) return "T-Storm";
    return "Unknown";
}

// Load cached weather on startup
function loadCachedWeather() {
    const cached = localStorage.getItem("weather");
    const cachedTime = localStorage.getItem("weatherTime");

    if (cached && cachedTime) {
        const age = Date.now() - Number(cachedTime);
        // Use cache if less than 1 hour old
        if (age < 60 * 60 * 1000) {
            try {
                weather = JSON.parse(cached);
                console.log("Using cached weather");
                return true;
            } catch (e) {
                console.log("Failed to parse cached weather");
            }
        }
    }
    return false;
}

function saveWeather() {
    if (weather) {
        localStorage.setItem("weather", JSON.stringify(weather));
        localStorage.setItem("weatherTime", String(Date.now()));
    }
}

// Get location from the Location sensor
let location = null;

function requestLocation() {
    location = new Location({
        onSample() {
            const sample = this.sample();
            console.log("Got location: " + sample.latitude + ", " + sample.longitude);
            this.close();
            // fetchWeather(sample.latitude, sample.longitude);
        }
    });
}

/*
async function fetchWeather(latitude, longitude) {
    try {
        let url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`;
        if (settings.useFahrenheit) {
            url += "&temperature_unit=fahrenheit";
        }

        console.log("Fetching: " + url);
        const response = await fetch(url);
        console.log("Status: " + response.status);

        const text = await response.text();
        console.log("Raw Response (first 50): " + text.substring(0, 50));
        
        const data = JSON.parse(text);
        console.log("Weather JSON: " + JSON.stringify(data));

        weather = {
            temp: Math.round(data.current_weather.temperature),
            conditions: getWeatherDescription(data.current_weather.weathercode)
        };

        console.log("Weather: " + weather.temp + ", " + weather.conditions);
        saveWeather();
        drawScreen();

    } catch (e) {
        console.log("Weather fetch error: " + e);
    }
}
*/

function drawScreen(event) {
    const now = event?.date ?? lastDate;
    if (event?.date) lastDate = event.date;

    render.begin();
    render.fillRectangle(bgColor, 0, 0, render.width, render.height);

    // Compute layout positions from unobstructed area
    const blockHeight = timeFont.height + dateFont.height;
    const timeY = (render.unobstructed.height - blockHeight) / 2;
    const dateY = timeY + timeFont.height;

    // Format time as HHMM (24h) or HMM (12h)
    let hours = now.getHours();
    if (!settings.use24Hour) {
        hours = hours % 12 || 12;
    }
    const hoursStr = String(hours).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const timeStr = `${hoursStr}${minutes}`;

    // Draw time centered
    let width = render.getTextWidth(timeStr, timeFont);
    render.drawText(timeStr, timeFont, textColor,
        (render.unobstructed.width - width) / 2, timeY);

    // Draw date if setting is enabled
    if (settings.showDate) {
        const dayName = DAYS[now.getDay()];
        const monthName = MONTHS[now.getMonth()];
        const dateStr = `${dayName} ${monthName} ${String(now.getDate()).padStart(2, "0")}`;

        width = render.getTextWidth(dateStr, dateFont);
        render.drawText(dateStr, dateFont, textColor,
            (render.unobstructed.width - width) / 2, dateY);
    }

    // Draw steps at bottom
    const stepsY = render.unobstructed.height - smallFont.height - (render.unobstructed.height < 180 ? 6 : 20);
    const stepsStr = `${steps} steps`;
    width = render.getTextWidth(stepsStr, smallFont);
    render.drawText(stepsStr, smallFont, textColor,
        (render.unobstructed.width - width) / 2, stepsY);

    render.end();
}

// Update every minute (fires immediately when registered)
watch.addEventListener("minutechange", (event) => {
    updateSteps();
    drawScreen(event);
});

// Redraw when Timeline Quick View changes the unobstructed area
watch.addEventListener("resize", drawScreen);

// Receive settings from Clay configuration page
const message = new Message({
    keys: ["BackgroundColor", "TextColor", "TemperatureUnit", "ShowDate", "HourFormat"],
    onReadable() {
        const msg = this.read();

        const bg = msg.get("BackgroundColor");
        if (bg !== undefined) {
            settings.backgroundColor = { r: (bg >> 16) & 0xFF, g: (bg >> 8) & 0xFF, b: bg & 0xFF };
        }
        const tc = msg.get("TextColor");
        if (tc !== undefined) {
            settings.textColor = { r: (tc >> 16) & 0xFF, g: (tc >> 8) & 0xFF, b: tc & 0xFF };
        }
        const tu = msg.get("TemperatureUnit");
        if (tu !== undefined) {
            settings.useFahrenheit = tu === 1;
        }
        const sd = msg.get("ShowDate");
        if (sd !== undefined) {
            settings.showDate = sd === 1;
        }
        const hf = msg.get("HourFormat");
        if (hf !== undefined) {
            settings.use24Hour = hf === 1;
        }

        saveSettings();
        updateColors();
        drawScreen();
    }
});
