// Öffentliche Kopie ohne persönliche Inhalte – die echten Einstellungen kommen aus dem privaten Repository.
(function (root) {
  const D = {
  "version": 1,
  "timezone": "Europe/Berlin",
  "accounts": [],
  "markets": [],
  "sessions": [
    {
      "name": "Vormittag",
      "from": "09:00",
      "to": "14:30"
    },
    {
      "name": "Nachmittag (US)",
      "from": "15:45",
      "to": "18:00"
    }
  ],
  "rules": {
    "maxLosses": 2,
    "dailyTargetPct": 1,
    "minChecklist": 70,
    "cooldownLossMin": 15,
    "cooldownNewsMin": 15,
    "newsImpacts": [
      "High"
    ],
    "reviewWeekday": 6
  },
  "ruleTexts": [],
  "holidayCountries": [
    {
      "code": "US",
      "name": "USA",
      "region": "US"
    },
    {
      "code": "GB",
      "name": "UK",
      "region": "London"
    },
    {
      "code": "DE",
      "name": "Deutschland",
      "region": "Europa"
    },
    {
      "code": "JP",
      "name": "Japan",
      "region": "Asien"
    },
    {
      "code": "CN",
      "name": "China",
      "region": "Asien"
    },
    {
      "code": "HK",
      "name": "Hongkong",
      "region": "Asien"
    }
  ],
  "newsCurrencies": [
    "USD",
    "EUR",
    "GBP",
    "JPY",
    "CNY"
  ],
  "timeframes": [
    {
      "id": "D",
      "name": "Daily",
      "validDays": 28,
      "questions": [],
      "guide": "",
      "elements": []
    },
    {
      "id": "4H",
      "name": "4h",
      "validDays": 7,
      "questions": [],
      "guide": "",
      "elements": []
    },
    {
      "id": "1H",
      "name": "1h",
      "validDays": 2,
      "questions": [],
      "guide": "",
      "elements": []
    },
    {
      "id": "15m",
      "name": "15min",
      "validDays": 1,
      "questions": [],
      "guide": "",
      "elements": []
    },
    {
      "id": "5m",
      "name": "5min",
      "validDays": 1,
      "questions": [],
      "guide": "",
      "elements": []
    },
    {
      "id": "1m",
      "name": "1min",
      "validDays": 1,
      "questions": [],
      "guide": "",
      "elements": []
    }
  ],
  "checklist": [],
  "executionQuestions": [],
  "emotionQuestions": [],
  "reflectionQuestions": [],
  "reviewQuestions": []
};
  if (typeof module !== "undefined" && module.exports) module.exports = D;
  else root.J_DEFAULTS = D;
})(typeof window !== "undefined" ? window : globalThis);
