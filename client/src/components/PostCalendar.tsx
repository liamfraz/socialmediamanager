import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
export interface CalendarPost {
  id: string;
  content: string;
  status: string;
  scheduledDate: Date;
}

interface PostCalendarProps {
  posts: CalendarPost[];
  onPostClick?: (postId: string) => void;
}

export default function PostCalendar({ posts, onPostClick }: PostCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const postsByDate = useMemo(() => {
    const map = new Map<string, CalendarPost[]>();
    posts.forEach((post) => {
      const dateKey = format(post.scheduledDate, "yyyy-MM-dd");
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(post);
    });
    return map;
  }, [posts]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300";
      case "pending":
        return "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300";
      case "rejected":
        return "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card className="mb-6" data-testid="calendar-container">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarIcon className="h-5 w-5" />
          Post Schedule
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            data-testid="button-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center font-medium" data-testid="text-current-month">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            data-testid="button-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayPosts = postsByDate.get(dateKey) || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={dateKey}
                className={`min-h-[80px] rounded-md border p-1 ${
                  isCurrentMonth ? "bg-background" : "bg-muted/30"
                } ${isToday ? "border-primary" : "border-border"}`}
                data-testid={`calendar-day-${dateKey}`}
              >
                <div
                  className={`mb-1 text-xs font-medium ${
                    isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                  } ${isToday ? "text-primary" : ""}`}
                >
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {dayPosts.slice(0, 2).map((post) => (
                    <div
                      key={post.id}
                      onClick={() => onPostClick?.(post.id)}
                      className={`cursor-pointer truncate rounded px-1 py-0.5 text-[10px] hover-elevate ${getStatusColor(
                        post.status
                      )}`}
                      title={post.content}
                      data-testid={`calendar-post-${post.id}`}
                    >
                      {post.content.slice(0, 20)}...
                    </div>
                  ))}
                  {dayPosts.length > 2 && (
                    <Badge variant="secondary" className="text-[10px]">
                      +{dayPosts.length - 2} more
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
