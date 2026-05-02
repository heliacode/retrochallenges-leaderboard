'use client';

import {
  Bar, BarChart,
  CartesianGrid, Cell,
  Line, LineChart,
  ResponsiveContainer,
  Scatter, ScatterChart, ZAxis,
  Tooltip,
  XAxis, YAxis,
} from 'recharts';

const RED        = '#B53120';
const RED_LIGHT  = '#E40058';
const GRAY_LINE  = '#3D3D3D';
const GRAY_TEXT  = '#7C7C7C';

const tooltipStyle = {
  backgroundColor: '#1A1A1A',
  border: '1px solid #545454',
  borderRadius: '6px',
  color: '#E0E0E0',
};

interface TimeBucket { label: string; count: number; }

export function SubmissionsLine({ data, height = 200 }: { data: TimeBucket[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -20 }}>
        <CartesianGrid stroke={GRAY_LINE} strokeDasharray="3 3" />
        <XAxis dataKey="label" stroke={GRAY_TEXT} tick={{ fontSize: 11 }} />
        <YAxis stroke={GRAY_TEXT} tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: RED_LIGHT, strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey="count"
          stroke={RED_LIGHT}
          strokeWidth={2}
          dot={{ r: 2, fill: RED_LIGHT }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface RankRow { label: string; value: number; }

export function RankBar({ data, height = 220 }: { data: RankRow[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={GRAY_LINE} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" stroke={GRAY_TEXT} tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          stroke={GRAY_TEXT}
          width={140}
          tick={{ fontSize: 11, fill: '#BCBCBC' }}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(228, 0, 88, 0.1)' }} />
        <Bar dataKey="value" fill={RED} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface HeatmapCell { day: number; dayLabel: string; hour: number; count: number; }

// Day-of-week × hour heatmap rendered as a ScatterChart with dot size
// proportional to activity. Reads as a heatmap at our densities; avoids
// pulling in a separate heatmap library.
export function ActivityHeatmap({ data, height = 240 }: { data: HeatmapCell[]; height?: number }) {
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
        <CartesianGrid stroke={GRAY_LINE} strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="hour"
          name="Hour"
          domain={[-0.5, 23.5]}
          ticks={[0, 3, 6, 9, 12, 15, 18, 21]}
          stroke={GRAY_TEXT}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="day"
          name="Day"
          domain={[-0.5, 6.5]}
          ticks={[0, 1, 2, 3, 4, 5, 6]}
          tickFormatter={(v: number) => dayLabels[v] ?? ''}
          stroke={GRAY_TEXT}
          tick={{ fontSize: 11, fill: '#BCBCBC' }}
          width={32}
          reversed
        />
        <ZAxis
          type="number"
          dataKey="count"
          range={[0, 360]}
          domain={[0, maxCount]}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ strokeDasharray: '3 3', stroke: RED_LIGHT }}
          formatter={(value, name) =>
            name === 'count' ? [`${value} runs`, 'submissions'] : value
          }
          labelFormatter={() => ''}
        />
        <Scatter data={data} fill={RED}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.count === 0 ? '#2C2C2C' : RED}
              fillOpacity={d.count === 0 ? 0.4 : 0.45 + 0.55 * (d.count / maxCount)}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
