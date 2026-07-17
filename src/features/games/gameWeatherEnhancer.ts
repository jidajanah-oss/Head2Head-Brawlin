/* H2H-GAME-WEATHER-V1 */
type Stadium = {
  latitude: number;
  longitude: number;
  indoor?: boolean;
};

type WeatherPayload = {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
    weather_code?: number[];
    wind_speed_10m?: number[];
  };
};

const STADIUMS: Record<string, Stadium> = {
  ARI:{latitude:33.5276,longitude:-112.2626,indoor:true},
  ATL:{latitude:33.7554,longitude:-84.4008,indoor:true},
  BAL:{latitude:39.2780,longitude:-76.6227},
  BUF:{latitude:42.7738,longitude:-78.7868},
  CAR:{latitude:35.2258,longitude:-80.8528},
  CHI:{latitude:41.8623,longitude:-87.6167},
  CIN:{latitude:39.0955,longitude:-84.5161},
  CLE:{latitude:41.5061,longitude:-81.6995},
  DAL:{latitude:32.7473,longitude:-97.0945,indoor:true},
  DEN:{latitude:39.7439,longitude:-105.0201},
  DET:{latitude:42.3400,longitude:-83.0456,indoor:true},
  GB:{latitude:44.5013,longitude:-88.0622},
  HOU:{latitude:29.6847,longitude:-95.4107,indoor:true},
  IND:{latitude:39.7601,longitude:-86.1639,indoor:true},
  JAX:{latitude:30.3239,longitude:-81.6373},
  KC:{latitude:39.0489,longitude:-94.4839},
  LV:{latitude:36.0908,longitude:-115.1830,indoor:true},
  LAC:{latitude:33.9535,longitude:-118.3392,indoor:true},
  LAR:{latitude:33.9535,longitude:-118.3392,indoor:true},
  MIA:{latitude:25.9580,longitude:-80.2389},
  MIN:{latitude:44.9736,longitude:-93.2575,indoor:true},
  NE:{latitude:42.0909,longitude:-71.2643},
  NO:{latitude:29.9511,longitude:-90.0812,indoor:true},
  NYG:{latitude:40.8135,longitude:-74.0745},
  NYJ:{latitude:40.8135,longitude:-74.0745},
  PHI:{latitude:39.9008,longitude:-75.1675},
  PIT:{latitude:40.4468,longitude:-80.0158},
  SEA:{latitude:47.5952,longitude:-122.3316},
  SF:{latitude:37.4030,longitude:-121.9700},
  TB:{latitude:27.9759,longitude:-82.5033},
  TEN:{latitude:36.1665,longitude:-86.7713},
  WAS:{latitude:38.9077,longitude:-76.8645},
};

const cache = new Map<string, Promise<string>>();

function condition(code: number | undefined): string {
  if (code == null) return "Forecast";
  if (code === 0) return "Clear";
  if ([1,2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if ([45,48].includes(code)) return "Fog";
  if ([71,73,75,77,85,86].includes(code)) return "Snow";
  if ([95,96,99].includes(code)) return "Storms";
  return "Rain";
}

function homeTeam(card: Element): string | null {
  const teams = Array.from(card.querySelectorAll(".team-wordmark-abbr"))
    .map((node) => (node.textContent ?? "").trim().toUpperCase())
    .filter(Boolean);
  return teams.length >= 2 ? teams[1] : null;
}

function kickoff(card: Element): Date | null {
  const values = Array.from(card.querySelectorAll(".game-center-details strong"))
    .map((node) => node.textContent?.trim() ?? "");
  const value = values.find((text) =>
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(text),
  );
  if (!value) return null;
  const withYear = /\b20\d{2}\b/.test(value)
    ? value
    : `${value}, ${new Date().getFullYear()}`;
  const parsed = new Date(withYear.replace(/\b(?:ET|CT|MT|PT)\b/gi, "").trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function nearest(times: string[], date: Date): number {
  let result = -1;
  let distance = Number.POSITIVE_INFINITY;
  times.forEach((value, index) => {
    const next = Math.abs(new Date(`${value}Z`).getTime() - date.getTime());
    if (next < distance) {
      distance = next;
      result = index;
    }
  });
  return result;
}

async function forecast(team: string, date: Date, venue: Stadium): Promise<string> {
  if (venue.indoor) return "Indoor · Climate controlled";

  const daysAway = (date.getTime() - Date.now()) / 86400000;
  if (daysAway > 16) return "Forecast closer to kickoff";
  if (daysAway < -2) return "Game weather unavailable";

  const key = `${team}:${date.toISOString().slice(0,13)}`;
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      const params = new URLSearchParams({
        latitude:String(venue.latitude),
        longitude:String(venue.longitude),
        hourly:"temperature_2m,precipitation_probability,weather_code,wind_speed_10m",
        temperature_unit:"fahrenheit",
        wind_speed_unit:"mph",
        timezone:"GMT",
        forecast_days:"16",
      });
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
      );
      if (!response.ok) throw new Error("Weather request failed");
      const payload = await response.json() as WeatherPayload;
      const index = nearest(payload.hourly?.time ?? [], date);
      if (index < 0) return "Forecast closer to kickoff";
      const temp = payload.hourly?.temperature_2m?.[index];
      const rain = payload.hourly?.precipitation_probability?.[index];
      const wind = payload.hourly?.wind_speed_10m?.[index];
      const code = payload.hourly?.weather_code?.[index];
      return [
        temp == null ? null : `${Math.round(temp)}°F`,
        condition(code),
        rain == null ? null : `${Math.round(rain)}% rain`,
        wind == null ? null : `${Math.round(wind)} mph`,
      ].filter(Boolean).join(" · ");
    })().catch(() => "Forecast temporarily unavailable"));
  }
  return cache.get(key)!;
}

async function enhance(card: Element): Promise<void> {
  if (card.querySelector("[data-game-weather]")) return;
  const details = card.querySelector(".game-center-details");
  if (!details) return;

  const box = document.createElement("div");
  box.className = "game-center-weather";
  box.dataset.gameWeather = "true";
  box.innerHTML = "<span>Weather</span><strong>Checking forecast…</strong>";
  details.append(box);

  const value = box.querySelector("strong");
  const team = homeTeam(card);
  const date = kickoff(card);
  if (!value || !team || !STADIUMS[team]) {
    if (value) value.textContent = "Forecast unavailable";
    return;
  }
  value.textContent = date
    ? await forecast(team, date, STADIUMS[team])
    : STADIUMS[team].indoor
      ? "Indoor · Climate controlled"
      : "Forecast closer to kickoff";
}

function run(): void {
  document.querySelectorAll(".game-center-card").forEach((card) => {
    void enhance(card);
  });
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once:true });
  } else {
    run();
  }
  new MutationObserver(run).observe(document.documentElement, {
    childList:true,
    subtree:true,
  });
}
