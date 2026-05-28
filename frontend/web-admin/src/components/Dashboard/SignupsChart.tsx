'use client';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { alpha, useTheme } from '@mui/material/styles';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';

export interface DailySignups {
  date: string;
  signups: number;
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
      <Typography variant="body2" sx={{ fontWeight: 700, color: '#10B981' }}>
        {payload[0].value.toLocaleString()} signups
      </Typography>
    </Box>
  );
}

export function SignupsChart({ data }: { data: DailySignups[] }) {
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
              New Signups
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
              bgcolor: isDark ? alpha('#10B981', 0.12) : alpha('#10B981', 0.08),
              px: 1.25,
              py: 0.5,
              borderRadius: 2,
            }}
          >
            <PersonAddRoundedIcon sx={{ fontSize: 14, color: '#10B981' }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#10B981' }}>
              Users
            </Typography>
          </Box>
        </Box>

        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={14}>
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
            <Tooltip content={<CustomTooltip />} cursor={{ fill: alpha('#10B981', 0.05) }} />
            <Bar dataKey="signups" radius={[4, 4, 0, 0]}>
              {data.map((_, idx) => (
                <Cell
                  key={idx}
                  fill={alpha('#10B981', idx === data.length - 1 ? 1 : 0.45)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
