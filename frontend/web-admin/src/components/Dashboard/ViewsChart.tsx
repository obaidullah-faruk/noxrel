'use client';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { alpha, useTheme } from '@mui/material/styles';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';

export interface DailyViews {
  date: string;
  views: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!active || !payload?.length) return null;

  return (
    <Box
      sx={{
        bgcolor: isDark ? '#1E2535' : '#fff',
        border: `1px solid ${isDark ? alpha('#94A3B8', 0.15) : '#E2E8F0'}`,
        borderRadius: 2,
        p: '8px 12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      }}
    >
      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, color: '#6366F1' }}>
        {payload[0].value.toLocaleString()} views
      </Typography>
    </Box>
  );
}

export function ViewsChart({ data }: { data: DailyViews[] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const gridColor = isDark ? alpha('#94A3B8', 0.08) : '#F1F5F9';
  const tickColor = theme.palette.text.secondary;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: '20px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
              Video Views
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              Last 14 days
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              bgcolor: isDark ? alpha('#6366F1', 0.12) : alpha('#6366F1', 0.08),
              px: 1.25,
              py: 0.5,
              borderRadius: 2,
            }}
          >
            <VisibilityRoundedIcon sx={{ fontSize: 14, color: '#6366F1' }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#6366F1' }}>
              Views
            </Typography>
          </Box>
        </Box>

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366F1" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridColor} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: tickColor }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: tickColor }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: alpha('#6366F1', 0.2), strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="views"
              stroke="#6366F1"
              strokeWidth={2.5}
              fill="url(#viewsGrad)"
              dot={false}
              activeDot={{ r: 5, fill: '#6366F1', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
