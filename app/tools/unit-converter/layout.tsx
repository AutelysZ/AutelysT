import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Unit Converter - AutelysT",
  description: "Online unit converter supporting 16 categories including length, mass, volume, temperature, speed, pressure, energy, power, data storage, and more.",
  keywords: ["unit converter", "length", "mass", "volume", "temperature", "speed", "pressure", "energy", "power", "data", "metric", "imperial", "conversion"],
}

export default function UnitConverterLayout({ children }: { children: React.ReactNode }) {
  return children
}
