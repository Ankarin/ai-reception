"use client";

import { Button } from "@/components/ui/button";

interface QuickRepliesProps {
  replies: string[];
  onSelect: (reply: string) => void;
  primaryColor: string;
  textColor: string;
  borderColor: string;
}

export function QuickReplies({
  replies,
  onSelect,
  primaryColor,
  textColor,
  borderColor,
}: QuickRepliesProps) {
  if (!replies || replies.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3 mb-2">
      {replies.map((reply, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          onClick={() => onSelect(reply)}
          className="text-sm rounded-full hover:scale-105 transition-transform"
          style={{
            borderColor: borderColor,
            color: textColor,
            backgroundColor: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = primaryColor;
            e.currentTarget.style.color = "white";
            e.currentTarget.style.borderColor = primaryColor;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = textColor;
            e.currentTarget.style.borderColor = borderColor;
          }}
        >
          {reply}
        </Button>
      ))}
    </div>
  );
}
