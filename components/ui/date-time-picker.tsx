"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

interface DateTimePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  buttonLabel?: string
  iconOnly?: boolean
}

function useLocale12Hour() {
  const [is12Hour, setIs12Hour] = React.useState(false)

  React.useEffect(() => {
    const testDate = new Date(2023, 0, 1, 13, 0, 0)
    const formatted = testDate.toLocaleTimeString()
    setIs12Hour(formatted.includes("PM") || formatted.includes("AM"))
  }, [])

  return is12Hour
}

export function DateTimePicker({ date, setDate, buttonLabel = "Pick", iconOnly }: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const is12Hour = useLocale12Hour()

  const [displayMonth, setDisplayMonth] = React.useState<Date | undefined>(date)

  // Update display month when date prop changes
  React.useEffect(() => {
    if (date) {
      setDisplayMonth(date)
    }
  }, [date])

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      // Preserve time if date already exists
      if (date) {
        const newDate = new Date(selectedDate)
        newDate.setHours(date.getHours())
        newDate.setMinutes(date.getMinutes())
        newDate.setSeconds(date.getSeconds())
        setDate(newDate)
      } else {
        setDate(selectedDate)
      }
    }
  }

  const handleTimeChange = (type: "hour" | "minute" | "second", value: string) => {
    const currentDate = date || new Date()
    const newDate = new Date(currentDate)

    if (type === "hour") {
      newDate.setHours(Number.parseInt(value))
    } else if (type === "minute") {
      newDate.setMinutes(Number.parseInt(value))
    } else if (type === "second") {
      newDate.setSeconds(Number.parseInt(value))
    }

    setDate(newDate)
  }

  const hours = is12Hour
    ? Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i))
    : Array.from({ length: 24 }, (_, i) => i)

  const getCurrentHour = () => {
    if (!date) return undefined
    const hour = date.getHours()
    return is12Hour ? (hour % 12 === 0 ? 12 : hour % 12) : hour
  }

  const period = date ? (date.getHours() >= 12 ? "PM" : "AM") : "AM"

  const togglePeriod = () => {
    if (!date) return
    const newDate = new Date(date)
    const currentHour = newDate.getHours()
    newDate.setHours(currentHour >= 12 ? currentHour - 12 : currentHour + 12)
    setDate(newDate)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={iconOnly ? "icon" : "sm"}
          className={
            iconOnly
              ? "border-0 bg-transparent shadow-none text-muted-foreground/70 hover:text-foreground"
              : "justify-start text-left font-normal bg-transparent"
          }
          aria-label={iconOnly ? buttonLabel : undefined}
        >
          <CalendarIcon className={iconOnly ? "h-4 w-4" : "mr-2 h-4 w-4"} />
          {!iconOnly && buttonLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="sm:flex">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            initialFocus
            captionLayout="dropdown"
            fromYear={1900}
            toYear={2100}
          />
          <div className="flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x">
            {/* Hours */}
            <ScrollArea className="w-64 sm:w-auto">
              <div className="flex sm:flex-col p-2">
                {hours.map((hour) => (
                  <Button
                    key={hour}
                    size="icon"
                    variant={getCurrentHour() === hour ? "default" : "ghost"}
                    className="sm:w-full shrink-0 aspect-square"
                    onClick={() => {
                      let actualHour = hour
                      if (is12Hour) {
                        actualHour = hour === 12 ? 0 : hour
                        if (period === "PM") actualHour += 12
                      }
                      handleTimeChange("hour", actualHour.toString())
                    }}
                  >
                    {hour.toString().padStart(2, "0")}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>
            {/* Minutes */}
            <ScrollArea className="w-64 sm:w-auto">
              <div className="flex sm:flex-col p-2">
                {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                  <Button
                    key={minute}
                    size="icon"
                    variant={date && date.getMinutes() === minute ? "default" : "ghost"}
                    className="sm:w-full shrink-0 aspect-square"
                    onClick={() => handleTimeChange("minute", minute.toString())}
                  >
                    {minute.toString().padStart(2, "0")}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>
            {/* Seconds */}
            <ScrollArea className="w-64 sm:w-auto">
              <div className="flex sm:flex-col p-2">
                {Array.from({ length: 60 }, (_, i) => i).map((second) => (
                  <Button
                    key={second}
                    size="icon"
                    variant={date && date.getSeconds() === second ? "default" : "ghost"}
                    className="sm:w-full shrink-0 aspect-square"
                    onClick={() => handleTimeChange("second", second.toString())}
                  >
                    {second.toString().padStart(2, "0")}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>
            {is12Hour && (
              <div className="flex sm:flex-col p-2 gap-2">
                <Button
                  size="sm"
                  variant={period === "AM" ? "default" : "ghost"}
                  className="sm:w-full"
                  onClick={togglePeriod}
                >
                  AM
                </Button>
                <Button
                  size="sm"
                  variant={period === "PM" ? "default" : "ghost"}
                  className="sm:w-full"
                  onClick={togglePeriod}
                >
                  PM
                </Button>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
