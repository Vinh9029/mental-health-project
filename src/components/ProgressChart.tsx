import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

interface HistoryPoint {
  taken_at: string;
  phq9_score: number | null;
  gad7_score: number | null;
}

interface ProgressChartProps {
  history: HistoryPoint[];
}

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-card border rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="font-medium text-card-foreground">{entry.name}:</span>
          <span className="font-bold" style={{ color: entry.color }}>
            {entry.value ?? "—"}
          </span>
        </div>
      ))}
    </div>
  );
};

function TrendBadge({ values }: { values: (number | null)[] }) {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return <Minus className="h-4 w-4 text-muted-foreground" />;
  const delta = valid[valid.length - 1] - valid[0];
  if (delta < -1) return <TrendingDown className="h-4 w-4 text-green-500" />;
  if (delta > 1) return <TrendingUp className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export default function ProgressChart({ history }: ProgressChartProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
        <span className="text-4xl mb-3">📈</span>
        <p className="text-sm font-medium">No history yet</p>
        <p className="text-xs mt-1">Complete at least two assessments to see your progress chart.</p>
      </div>
    );
  }

  const data = history.map((h) => ({
    date: format(parseISO(h.taken_at), "MMM d"),
    PHQ9: h.phq9_score,
    GAD7: h.gad7_score,
  }));

  const phqValues = history.map((h) => h.phq9_score);
  const gadValues = history.map((h) => h.gad7_score);

  return (
    <div>
      {/* Legend badges */}
      <div className="flex gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-xs font-medium text-card-foreground">PHQ-9 (Depression)</span>
          <TrendBadge values={phqValues} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
          <span className="text-xs font-medium text-card-foreground">GAD-7 (Anxiety)</span>
          <TrendBadge values={gadValues} />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            domain={[0, 27]}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Severity reference lines */}
          <ReferenceLine y={5} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine y={10} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine y={15} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Line
            type="monotone"
            dataKey="PHQ9"
            name="PHQ-9"
            stroke="var(--primary)"
            strokeWidth={2.5}
            dot={{ r: 5, fill: "var(--primary)", strokeWidth: 0 }}
            activeDot={{ r: 7 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="GAD7"
            name="GAD-7"
            stroke="#f97316"
            strokeWidth={2.5}
            dot={{ r: 5, fill: "#f97316", strokeWidth: 0 }}
            activeDot={{ r: 7 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-[10px] text-muted-foreground mt-3 text-center">
        Dashed lines mark severity thresholds (Mild · Moderate · Severe). Lower is better.
      </p>
    </div>
  );
}
