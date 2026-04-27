/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			bg: 'hsl(var(--bg))',
  			'bg-sub': 'hsl(var(--bg-sub))',
  			surface: 'hsl(var(--surface))',
  			'surface-2': 'hsl(var(--surface-2))',
  			line: 'hsl(var(--line))',
  			'line-2': 'hsl(var(--line-2))',
  			ink: {
  				DEFAULT: 'hsl(var(--ink))',
  				2: 'hsl(var(--ink-2))',
  				3: 'hsl(var(--ink-3))',
  				4: 'hsl(var(--ink-4))'
  			},
  			'accent-ink': 'hsl(var(--accent-ink))',
  			pos: 'hsl(var(--pos))',
  			neg: {
  				DEFAULT: 'hsl(var(--neg))',
  				bg: 'hsl(var(--neg-bg))'
  			},
  			warn: {
  				DEFAULT: 'hsl(var(--warn))',
  				bg: 'hsl(var(--warn-bg))'
  			},
  			cat: {
  				rent: 'hsl(var(--cat-rent))',
  				utilities: 'hsl(var(--cat-utilities))',
  				groceries: 'hsl(var(--cat-groceries))',
  				internet: 'hsl(var(--cat-internet))',
  				other: 'hsl(var(--cat-other))'
  			}
  		},
  		fontFamily: {
  			sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
  			serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
  			mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			xl: '18px',
  			'2xl': '22px'
  		},
  		boxShadow: {
  			hero: '0 30px 80px -20px rgba(0,0,0,0.5)',
  			'accent-glow': '0 6px 16px -4px rgba(163,230,53,0.5)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: 0
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: 0
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
