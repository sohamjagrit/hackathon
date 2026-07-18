import { useEffect, useState } from 'react'

export interface LocalWeather {
  tempF: number
  condition: string
}

// Default demo location: Mountain View, CA
const LATITUDE = 37.3861
const LONGITUDE = -122.0839

function conditionFromCode(code: number): string {
  if (code === 0) return 'Clear'
  if (code <= 3) return 'Partly cloudy'
  if (code <= 48) return 'Foggy'
  if (code <= 67) return 'Rainy'
  if (code <= 77) return 'Snowy'
  if (code <= 82) return 'Showers'
  return 'Stormy'
}

export function useLocalWeather(): LocalWeather | null {
  const [weather, setWeather] = useState<LocalWeather | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const url =
      'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
      '&current=temperature_2m,weather_code&temperature_unit=fahrenheit'
    fetch(url, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        const current = data?.current
        if (typeof current?.temperature_2m !== 'number') return
        setWeather({
          tempF: Math.round(current.temperature_2m),
          condition: conditionFromCode(Number(current.weather_code ?? 0)),
        })
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  return weather
}
