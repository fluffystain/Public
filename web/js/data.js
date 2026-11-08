// Topic keywords, regions and cities, ported from the iOS app (Topic.swift, Location.swift in fluffystain/Tools).
// Shared by the browser app and the scheduled collector (scripts/trawl.mjs).

export const TOPICS = [{"id": "politics", "title": "Politics", "color": "#6b9eff", "terms": ["election", "parliament", "president", "minister", "government", "opposition"], "keywords": {"election": 2.0, "elections": 2.0, "vote": 1.5, "voters": 1.5, "ballot": 2.0, "parliament": 2.0, "parliamentary": 2.0, "senate": 1.5, "congress": 1.5, "president": 1.2, "presidential": 1.5, "prime minister": 2.0, "minister": 1.2, "ministry": 0.8, "cabinet": 1.5, "government": 1.0, "opposition": 1.5, "coalition": 1.5, "party": 1.0, "lawmakers": 1.5, "legislation": 1.2, "referendum": 2.0, "coup": 2.0, "diplomat": 1.5, "diplomatic": 1.5, "summit": 1.2, "sanctions": 1.2, "talks": 0.8, "treaty": 1.2, "constitution": 1.5, "impeachment": 2.0, "resign": 1.2, "resigns": 1.2, "policy": 0.6, "foreign minister": 2.0, "embassy": 1.2, "ambassador": 1.5, "junta": 1.5, "regime": 1.0, "campaign": 0.6, "mayor": 1.2, "governor": 1.2}}, {"id": "military", "title": "Military", "color": "#8cbf59", "terms": ["military", "army", "troops", "defence", "airstrike", "missile"], "keywords": {"military": 2.0, "army": 2.0, "armed forces": 2.0, "troops": 2.0, "soldiers": 2.0, "navy": 2.0, "naval": 1.5, "air force": 2.0, "airstrike": 2.0, "air strike": 2.0, "airstrikes": 2.0, "missile": 2.0, "missiles": 2.0, "drone": 1.5, "drones": 1.5, "artillery": 2.0, "shelling": 2.0, "offensive": 1.5, "frontline": 2.0, "front line": 2.0, "defence": 1.5, "defense": 1.5, "warship": 2.0, "fighter jet": 2.0, "nato": 1.5, "exercise": 0.8, "drills": 1.5, "brigade": 2.0, "battalion": 2.0, "weapons": 1.5, "arms": 1.0, "ceasefire": 1.5, "war": 1.2, "invasion": 2.0, "rebels": 1.2, "paramilitary": 2.0, "mobilisation": 2.0, "mobilization": 2.0, "conscription": 2.0, "nuclear": 1.0, "tank": 1.0, "tanks": 1.5, "general": 0.5, "combat": 1.5, "clashes": 1.2, "militia": 1.5, "rsf": 1.5}}, {"id": "economy", "title": "Economy", "color": "#f5c242", "terms": ["economy", "inflation", "GDP", "currency", "trade", "budget"], "keywords": {"economy": 2.0, "economic": 1.5, "inflation": 2.0, "gdp": 2.0, "growth": 0.8, "recession": 2.0, "currency": 2.0, "exchange rate": 2.0, "central bank": 2.0, "interest rate": 2.0, "interest rates": 2.0, "imf": 2.0, "world bank": 1.5, "debt": 1.5, "bond": 1.0, "bonds": 1.2, "budget": 1.5, "tax": 1.2, "taxes": 1.2, "trade": 1.2, "exports": 1.5, "imports": 1.5, "tariff": 2.0, "tariffs": 2.0, "investment": 1.2, "investors": 1.5, "stocks": 1.5, "market": 0.8, "markets": 1.0, "prices": 1.2, "fuel prices": 1.5, "oil": 1.0, "jobs": 1.0, "unemployment": 2.0, "wages": 1.5, "bank": 0.8, "loan": 1.2, "deficit": 1.5, "revenue": 1.0, "company": 0.6, "business": 0.8, "finance": 1.2}}, {"id": "social", "title": "Social", "color": "#d880f2", "terms": ["protest", "migrants", "health", "education", "strike", "humanitarian"], "keywords": {"protest": 2.0, "protests": 2.0, "protesters": 2.0, "demonstration": 2.0, "rally": 1.2, "strike": 1.2, "union": 1.0, "migrants": 2.0, "migration": 2.0, "refugees": 2.0, "displaced": 2.0, "humanitarian": 1.5, "aid": 1.0, "famine": 2.0, "hunger": 2.0, "food insecurity": 2.0, "health": 1.2, "hospital": 1.2, "outbreak": 2.0, "cholera": 2.0, "disease": 1.5, "vaccine": 1.5, "education": 1.5, "school": 1.0, "schools": 1.2, "students": 1.2, "religious": 1.2, "ethnic": 1.5, "community": 0.8, "human rights": 2.0, "women": 1.0, "children": 1.0, "poverty": 2.0, "housing": 1.5, "population": 1.0, "unrest": 1.5, "riots": 1.5, "civil society": 1.5, "lgbt": 1.5, "discrimination": 1.5}}, {"id": "security", "title": "Security", "color": "#ff6b61", "terms": ["attack", "terrorism", "police", "crime", "kidnapping", "militants"], "keywords": {"attack": 1.5, "attacks": 1.5, "terror": 2.0, "terrorist": 2.0, "terrorism": 2.0, "bomb": 2.0, "bombing": 2.0, "explosion": 1.5, "blast": 1.5, "gunmen": 2.0, "shooting": 1.5, "killed": 1.0, "police": 1.5, "arrested": 1.5, "arrests": 1.5, "crime": 1.5, "criminal": 1.2, "gang": 2.0, "gangs": 2.0, "cartel": 2.0, "kidnapping": 2.0, "kidnapped": 2.0, "hostage": 2.0, "militants": 2.0, "insurgents": 2.0, "jihadist": 2.0, "isis": 2.0, "islamic state": 2.0, "al-qaeda": 2.0, "al shabaab": 2.0, "smuggling": 1.5, "trafficking": 1.5, "border": 1.0, "security forces": 2.0, "curfew": 1.5, "violence": 1.2, "murder": 1.5, "piracy": 2.0, "extremist": 2.0, "counterterrorism": 2.0, "intelligence": 1.0, "espionage": 1.5, "spy": 1.5, "travel advice": 1.5}}, {"id": "information", "title": "Information", "color": "#4dd9d9", "terms": ["media", "journalist", "disinformation", "internet", "censorship", "cyber"], "keywords": {"media": 1.5, "journalist": 2.0, "journalists": 2.0, "press freedom": 2.0, "newspaper": 1.2, "broadcaster": 1.5, "television": 1.0, "tv": 0.8, "radio": 1.0, "disinformation": 2.0, "misinformation": 2.0, "propaganda": 2.0, "fake news": 2.0, "censorship": 2.0, "censor": 1.5, "internet": 1.5, "internet shutdown": 2.0, "social media": 2.0, "facebook": 1.2, "x": 0.3, "telegram": 1.2, "tiktok": 1.5, "online": 0.8, "cyber": 2.0, "cyberattack": 2.0, "hackers": 2.0, "hack": 1.5, "data breach": 2.0, "influence operation": 2.0, "ai": 0.8, "deepfake": 2.0, "telecom": 1.2, "satellite": 1.0, "blogger": 1.5, "information": 0.8, "narrative": 1.0}}, {"id": "infrastructure", "title": "Infrastructure", "color": "#ff9a40", "terms": ["power", "energy", "port", "railway", "airport", "water supply"], "keywords": {"infrastructure": 2.0, "power": 1.0, "electricity": 2.0, "blackout": 2.0, "outage": 2.0, "power cuts": 2.0, "grid": 1.5, "energy": 1.5, "gas": 1.0, "pipeline": 2.0, "refinery": 2.0, "nuclear plant": 2.0, "dam": 1.5, "water": 1.0, "water supply": 2.0, "port": 1.5, "ports": 1.5, "shipping": 1.5, "railway": 2.0, "rail": 1.5, "train": 1.2, "airport": 1.5, "flights": 1.2, "road": 1.0, "roads": 1.0, "bridge": 1.5, "construction": 1.2, "telecoms": 1.5, "fuel": 1.2, "fuel shortage": 2.0, "transport": 1.5, "logistics": 1.5, "mining": 1.0, "solar": 1.2, "wind farm": 1.5, "power plant": 2.0, "flood": 1.2, "floods": 1.2, "earthquake": 1.2, "subsea cable": 2.0, "undersea cable": 2.0, "data centre": 1.5, "data center": 1.5}}];

export const REGIONS = [
{
"name": "Middle East",
"members": [
"ae",
"ba",
"ir",
"is",
"iz",
"jo",
"ku",
"le",
"mu",
"qa",
"sa",
"sy",
"tu",
"ym",
"gz",
"we",
"eg"
],
"wiki": "Middle East",
"extra": []
},
{
"name": "Levant",
"members": [
"is",
"le",
"sy",
"jo",
"gz",
"we"
],
"wiki": "Levant",
"extra": []
},
{
"name": "Gulf States",
"members": [
"sa",
"ae",
"qa",
"ku",
"ba",
"mu"
],
"wiki": "Arab states of the Persian Gulf",
"extra": [
"Gulf Cooperation Council",
"GCC"
]
},
{
"name": "Red Sea",
"members": [
"ym",
"er",
"dj",
"sa",
"eg",
"su"
],
"wiki": "Red Sea",
"extra": [
"Houthi",
"Bab el-Mandeb"
]
},
{
"name": "North Africa",
"members": [
"mo",
"ag",
"ts",
"ly",
"eg"
],
"wiki": "North Africa",
"extra": [
"Maghreb"
]
},
{
"name": "Sahel",
"members": [
"ml",
"uv",
"ng",
"cd",
"mr"
],
"wiki": "Sahel",
"extra": []
},
{
"name": "West Africa",
"members": [
"ni",
"gh",
"sg",
"iv",
"ml",
"uv",
"ng",
"gv",
"sl",
"li",
"to",
"bn",
"ga",
"pu",
"cv",
"mr"
],
"wiki": "West Africa",
"extra": [
"ECOWAS"
]
},
{
"name": "Horn of Africa",
"members": [
"et",
"er",
"dj",
"so"
],
"wiki": "Horn of Africa",
"extra": []
},
{
"name": "East Africa",
"members": [
"ke",
"tz",
"ug",
"rw",
"by",
"od",
"et",
"so"
],
"wiki": "East Africa",
"extra": []
},
{
"name": "Great Lakes (Africa)",
"members": [
"cg",
"rw",
"by",
"ug"
],
"wiki": "African Great Lakes",
"extra": [
"M23"
]
},
{
"name": "Southern Africa",
"members": [
"sf",
"zi",
"mz",
"za",
"mi",
"bc",
"wa",
"ao",
"lt",
"wz"
],
"wiki": "Southern Africa",
"extra": [
"SADC"
]
},
{
"name": "Western Europe",
"members": [
"uk",
"fr",
"gm",
"be",
"nl",
"lu",
"ei",
"sz",
"au"
],
"wiki": "Western Europe",
"extra": []
},
{
"name": "Nordic Countries",
"members": [
"no",
"sw",
"fi",
"da",
"ic"
],
"wiki": "Nordic countries",
"extra": []
},
{
"name": "Baltic States",
"members": [
"en",
"lg",
"lh"
],
"wiki": "Baltic states",
"extra": []
},
{
"name": "Eastern Europe",
"members": [
"up",
"bo",
"md",
"pl",
"ro",
"hu",
"lo",
"ez",
"bu"
],
"wiki": "Eastern Europe",
"extra": []
},
{
"name": "Western Balkans",
"members": [
"ri",
"bk",
"kv",
"mj",
"mk",
"al"
],
"wiki": "Western Balkans",
"extra": []
},
{
"name": "South Caucasus",
"members": [
"gg",
"am",
"aj"
],
"wiki": "South Caucasus",
"extra": []
},
{
"name": "Black Sea",
"members": [
"up",
"rs",
"tu",
"gg",
"ro",
"bu"
],
"wiki": "Black Sea",
"extra": []
},
{
"name": "Arctic",
"members": [
"no",
"rs",
"ca",
"us",
"da",
"gl",
"ic",
"fi",
"sw"
],
"wiki": "Arctic",
"extra": [
"Arctic Council"
]
},
{
"name": "Central Asia",
"members": [
"kz",
"kg",
"ti",
"tx",
"uz"
],
"wiki": "Central Asia",
"extra": []
},
{
"name": "South Asia",
"members": [
"in",
"pk",
"bg",
"ce",
"np",
"af",
"bt",
"mv"
],
"wiki": "South Asia",
"extra": []
},
{
"name": "Southeast Asia",
"members": [
"id",
"my",
"rp",
"th",
"vm",
"bm",
"cb",
"la",
"sn",
"bx",
"tt"
],
"wiki": "Southeast Asia",
"extra": [
"ASEAN"
]
},
{
"name": "South China Sea",
"members": [
"ch",
"rp",
"vm",
"my",
"bx",
"tw"
],
"wiki": "South China Sea",
"extra": [
"Spratly",
"Paracel",
"Scarborough Shoal"
]
},
{
"name": "Taiwan Strait",
"members": [
"tw",
"ch"
],
"wiki": "Taiwan Strait",
"extra": []
},
{
"name": "Korean Peninsula",
"members": [
"kn",
"ks"
],
"wiki": "Korean Peninsula",
"extra": []
},
{
"name": "Indo-Pacific",
"members": [
"ch",
"ja",
"in",
"as",
"id",
"rp",
"ks",
"tw",
"vm"
],
"wiki": "Indo-Pacific",
"extra": [
"AUKUS",
"Quad"
]
},
{
"name": "Pacific Islands",
"members": [
"fj",
"pp",
"bp",
"nh",
"ws",
"tn",
"kr",
"tv",
"nr",
"ps",
"rm",
"fm"
],
"wiki": "Pacific Islands",
"extra": [
"Pacific Islands Forum"
]
},
{
"name": "Central America",
"members": [
"gt",
"bh",
"es",
"ho",
"nu",
"cs",
"pm"
],
"wiki": "Central America",
"extra": []
},
{
"name": "Caribbean",
"members": [
"cu",
"ha",
"dr",
"jm",
"td",
"bf",
"bb",
"rq"
],
"wiki": "Caribbean",
"extra": [
"CARICOM"
]
},
{
"name": "Andean States",
"members": [
"co",
"ve",
"ec",
"pe",
"bl"
],
"wiki": "Andean states",
"extra": []
},
{
"name": "Southern Cone",
"members": [
"ar",
"ci",
"uy",
"pa",
"br"
],
"wiki": "Southern Cone",
"extra": []
},
{
"name": "North America",
"members": [
"us",
"ca",
"mx"
],
"wiki": "North America",
"extra": []
}
];

export const CITIES = [
{
"name": "London",
"country": "uk",
"extra": []
},
{
"name": "Belfast",
"country": "uk",
"extra": []
},
{
"name": "Paris",
"country": "fr",
"extra": []
},
{
"name": "Marseille",
"country": "fr",
"extra": []
},
{
"name": "Berlin",
"country": "gm",
"extra": []
},
{
"name": "Brussels",
"country": "be",
"extra": []
},
{
"name": "The Hague",
"country": "nl",
"extra": []
},
{
"name": "Madrid",
"country": "sp",
"extra": []
},
{
"name": "Rome",
"country": "it",
"extra": []
},
{
"name": "Athens",
"country": "gr",
"extra": []
},
{
"name": "Warsaw",
"country": "pl",
"extra": []
},
{
"name": "Vilnius",
"country": "lh",
"extra": []
},
{
"name": "Riga",
"country": "lg",
"extra": []
},
{
"name": "Tallinn",
"country": "en",
"extra": []
},
{
"name": "Narva",
"country": "en",
"extra": []
},
{
"name": "Helsinki",
"country": "fi",
"extra": []
},
{
"name": "Stockholm",
"country": "sw",
"extra": []
},
{
"name": "Oslo",
"country": "no",
"extra": []
},
{
"name": "Belgrade",
"country": "ri",
"extra": []
},
{
"name": "Pristina",
"country": "kv",
"extra": []
},
{
"name": "Sarajevo",
"country": "bk",
"extra": []
},
{
"name": "Chisinau",
"country": "md",
"extra": []
},
{
"name": "Tiraspol",
"country": "md",
"extra": [
"Transnistria"
]
},
{
"name": "Kyiv",
"country": "up",
"extra": [
"Kiev"
]
},
{
"name": "Kharkiv",
"country": "up",
"extra": []
},
{
"name": "Odesa",
"country": "up",
"extra": [
"Odessa"
]
},
{
"name": "Zaporizhzhia",
"country": "up",
"extra": []
},
{
"name": "Dnipro",
"country": "up",
"extra": []
},
{
"name": "Lviv",
"country": "up",
"extra": []
},
{
"name": "Kherson",
"country": "up",
"extra": []
},
{
"name": "Donetsk",
"country": "up",
"extra": []
},
{
"name": "Sevastopol",
"country": "up",
"extra": [
"Crimea"
]
},
{
"name": "Minsk",
"country": "bo",
"extra": []
},
{
"name": "Moscow",
"country": "rs",
"extra": []
},
{
"name": "St Petersburg",
"country": "rs",
"extra": [
"Saint Petersburg"
]
},
{
"name": "Kaliningrad",
"country": "rs",
"extra": []
},
{
"name": "Istanbul",
"country": "tu",
"extra": []
},
{
"name": "Ankara",
"country": "tu",
"extra": []
},
{
"name": "Tbilisi",
"country": "gg",
"extra": []
},
{
"name": "Yerevan",
"country": "am",
"extra": []
},
{
"name": "Baku",
"country": "aj",
"extra": []
},
{
"name": "Astana",
"country": "kz",
"extra": []
},
{
"name": "Almaty",
"country": "kz",
"extra": []
},
{
"name": "Tashkent",
"country": "uz",
"extra": []
},
{
"name": "Bishkek",
"country": "kg",
"extra": []
},
{
"name": "Dushanbe",
"country": "ti",
"extra": []
},
{
"name": "Jerusalem",
"country": "is",
"extra": []
},
{
"name": "Tel Aviv",
"country": "is",
"extra": []
},
{
"name": "Gaza City",
"country": "gz",
"extra": [
"Gaza"
]
},
{
"name": "Ramallah",
"country": "we",
"extra": []
},
{
"name": "Beirut",
"country": "le",
"extra": []
},
{
"name": "Damascus",
"country": "sy",
"extra": []
},
{
"name": "Aleppo",
"country": "sy",
"extra": []
},
{
"name": "Idlib",
"country": "sy",
"extra": []
},
{
"name": "Amman",
"country": "jo",
"extra": []
},
{
"name": "Baghdad",
"country": "iz",
"extra": []
},
{
"name": "Erbil",
"country": "iz",
"extra": []
},
{
"name": "Basra",
"country": "iz",
"extra": []
},
{
"name": "Mosul",
"country": "iz",
"extra": []
},
{
"name": "Tehran",
"country": "ir",
"extra": []
},
{
"name": "Riyadh",
"country": "sa",
"extra": []
},
{
"name": "Jeddah",
"country": "sa",
"extra": []
},
{
"name": "Dubai",
"country": "ae",
"extra": []
},
{
"name": "Abu Dhabi",
"country": "ae",
"extra": []
},
{
"name": "Doha",
"country": "qa",
"extra": []
},
{
"name": "Muscat",
"country": "mu",
"extra": []
},
{
"name": "Sanaa",
"country": "ym",
"extra": [
"Sana'a"
]
},
{
"name": "Aden",
"country": "ym",
"extra": []
},
{
"name": "Hodeidah",
"country": "ym",
"extra": []
},
{
"name": "Cairo",
"country": "eg",
"extra": []
},
{
"name": "Tripoli",
"country": "ly",
"extra": []
},
{
"name": "Benghazi",
"country": "ly",
"extra": []
},
{
"name": "Tunis",
"country": "ts",
"extra": []
},
{
"name": "Algiers",
"country": "ag",
"extra": []
},
{
"name": "Rabat",
"country": "mo",
"extra": []
},
{
"name": "Khartoum",
"country": "su",
"extra": []
},
{
"name": "Port Sudan",
"country": "su",
"extra": []
},
{
"name": "El Fasher",
"country": "su",
"extra": [
"Darfur"
]
},
{
"name": "Juba",
"country": "od",
"extra": []
},
{
"name": "Addis Ababa",
"country": "et",
"extra": []
},
{
"name": "Mogadishu",
"country": "so",
"extra": []
},
{
"name": "Hargeisa",
"country": "so",
"extra": [
"Somaliland"
]
},
{
"name": "Djibouti",
"country": "dj",
"extra": []
},
{
"name": "Nairobi",
"country": "ke",
"extra": []
},
{
"name": "Kampala",
"country": "ug",
"extra": []
},
{
"name": "Kigali",
"country": "rw",
"extra": []
},
{
"name": "Goma",
"country": "cg",
"extra": []
},
{
"name": "Kinshasa",
"country": "cg",
"extra": []
},
{
"name": "Bamako",
"country": "ml",
"extra": []
},
{
"name": "Niamey",
"country": "ng",
"extra": []
},
{
"name": "Ouagadougou",
"country": "uv",
"extra": []
},
{
"name": "N'Djamena",
"country": "cd",
"extra": []
},
{
"name": "Lagos",
"country": "ni",
"extra": []
},
{
"name": "Abuja",
"country": "ni",
"extra": []
},
{
"name": "Maiduguri",
"country": "ni",
"extra": []
},
{
"name": "Accra",
"country": "gh",
"extra": []
},
{
"name": "Dakar",
"country": "sg",
"extra": []
},
{
"name": "Abidjan",
"country": "iv",
"extra": []
},
{
"name": "Luanda",
"country": "ao",
"extra": []
},
{
"name": "Maputo",
"country": "mz",
"extra": []
},
{
"name": "Cabo Delgado",
"country": "mz",
"extra": []
},
{
"name": "Harare",
"country": "zi",
"extra": []
},
{
"name": "Johannesburg",
"country": "sf",
"extra": []
},
{
"name": "Cape Town",
"country": "sf",
"extra": []
},
{
"name": "Antananarivo",
"country": "ma",
"extra": []
},
{
"name": "Kabul",
"country": "af",
"extra": []
},
{
"name": "Islamabad",
"country": "pk",
"extra": []
},
{
"name": "Karachi",
"country": "pk",
"extra": []
},
{
"name": "Peshawar",
"country": "pk",
"extra": []
},
{
"name": "Quetta",
"country": "pk",
"extra": []
},
{
"name": "New Delhi",
"country": "in",
"extra": [
"Delhi"
]
},
{
"name": "Mumbai",
"country": "in",
"extra": []
},
{
"name": "Srinagar",
"country": "in",
"extra": [
"Kashmir"
]
},
{
"name": "Dhaka",
"country": "bg",
"extra": []
},
{
"name": "Colombo",
"country": "ce",
"extra": []
},
{
"name": "Kathmandu",
"country": "np",
"extra": []
},
{
"name": "Yangon",
"country": "bm",
"extra": [
"Rangoon"
]
},
{
"name": "Naypyidaw",
"country": "bm",
"extra": []
},
{
"name": "Bangkok",
"country": "th",
"extra": []
},
{
"name": "Hanoi",
"country": "vm",
"extra": []
},
{
"name": "Ho Chi Minh City",
"country": "vm",
"extra": []
},
{
"name": "Phnom Penh",
"country": "cb",
"extra": []
},
{
"name": "Manila",
"country": "rp",
"extra": []
},
{
"name": "Jakarta",
"country": "id",
"extra": []
},
{
"name": "Kuala Lumpur",
"country": "my",
"extra": []
},
{
"name": "Singapore",
"country": "sn",
"extra": []
},
{
"name": "Beijing",
"country": "ch",
"extra": []
},
{
"name": "Shanghai",
"country": "ch",
"extra": []
},
{
"name": "Shenzhen",
"country": "ch",
"extra": []
},
{
"name": "Hong Kong",
"country": "hk",
"extra": []
},
{
"name": "Urumqi",
"country": "ch",
"extra": [
"Xinjiang"
]
},
{
"name": "Lhasa",
"country": "ch",
"extra": [
"Tibet"
]
},
{
"name": "Taipei",
"country": "tw",
"extra": []
},
{
"name": "Kaohsiung",
"country": "tw",
"extra": []
},
{
"name": "Tokyo",
"country": "ja",
"extra": []
},
{
"name": "Okinawa",
"country": "ja",
"extra": []
},
{
"name": "Seoul",
"country": "ks",
"extra": []
},
{
"name": "Pyongyang",
"country": "kn",
"extra": []
},
{
"name": "Ulaanbaatar",
"country": "mg",
"extra": []
},
{
"name": "Canberra",
"country": "as",
"extra": []
},
{
"name": "Sydney",
"country": "as",
"extra": []
},
{
"name": "Wellington",
"country": "nz",
"extra": []
},
{
"name": "Port Moresby",
"country": "pp",
"extra": []
},
{
"name": "Honiara",
"country": "bp",
"extra": []
},
{
"name": "Noumea",
"country": "nc",
"extra": []
},
{
"name": "Washington",
"country": "us",
"extra": [
"Washington DC"
]
},
{
"name": "New York",
"country": "us",
"extra": []
},
{
"name": "Los Angeles",
"country": "us",
"extra": []
},
{
"name": "Ottawa",
"country": "ca",
"extra": []
},
{
"name": "Mexico City",
"country": "mx",
"extra": []
},
{
"name": "Culiacan",
"country": "mx",
"extra": [
"Sinaloa"
]
},
{
"name": "Tijuana",
"country": "mx",
"extra": []
},
{
"name": "Havana",
"country": "cu",
"extra": []
},
{
"name": "Port-au-Prince",
"country": "ha",
"extra": []
},
{
"name": "Guatemala City",
"country": "gt",
"extra": []
},
{
"name": "San Salvador",
"country": "es",
"extra": []
},
{
"name": "Tegucigalpa",
"country": "ho",
"extra": []
},
{
"name": "Managua",
"country": "nu",
"extra": []
},
{
"name": "Panama City",
"country": "pm",
"extra": []
},
{
"name": "Bogota",
"country": "co",
"extra": [
"Bogotá"
]
},
{
"name": "Medellin",
"country": "co",
"extra": [
"Medellín"
]
},
{
"name": "Caracas",
"country": "ve",
"extra": []
},
{
"name": "Quito",
"country": "ec",
"extra": []
},
{
"name": "Guayaquil",
"country": "ec",
"extra": []
},
{
"name": "Lima",
"country": "pe",
"extra": []
},
{
"name": "La Paz",
"country": "bl",
"extra": []
},
{
"name": "Santiago",
"country": "ci",
"extra": []
},
{
"name": "Buenos Aires",
"country": "ar",
"extra": []
},
{
"name": "Sao Paulo",
"country": "br",
"extra": [
"São Paulo"
]
},
{
"name": "Rio de Janeiro",
"country": "br",
"extra": []
},
{
"name": "Brasilia",
"country": "br",
"extra": [
"Brasília"
]
},
{
"name": "Montevideo",
"country": "uy",
"extra": []
},
{
"name": "Stanley",
"country": "fk",
"extra": []
}
];
