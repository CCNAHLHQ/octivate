# Component Mapping

## Landing Page (octivate.html) → React Components

### Layout Components
- `Nav` - Fixed navigation with scroll effects
- `Hero` - Main hero section with visual network
- `Ticker` - Scrolling news ticker
- `Section` - Reusable section wrapper
- `Footer` - Page footer

### Feature Components
- `ProblemCards` - Grid of problem statement cards
- `Pipeline` - 4-step pipeline visualization
- `PSNFramework` - Power-Systems-Narratives interactive framework
- `DashboardDemo` - Interactive dashboard preview
- `Personas` - Bento grid of user personas
- `RegionSection` - Caribbean region information
- `Products` - Product/service cards
- `CTABand` - Call-to-action section

### UI Components
- `Button` - Primary, ghost, small variants
- `Pill` - Status pills with dots
- `Card` - Base card component
- `Badge` - Confidence badges
- `Chip` - Filter/select chips

## Dashboard (dashboard.html) → React Components

### Layout Components
- `AppShell` - Main application shell with sidebar
- `TopBar` - Top navigation bar
- `Sidebar` - Side navigation with sections
- `ProtoBanner` - Prototype banner (dismissable)
- `Workspace` - Main content area

### View Components
- `OverviewView` - Home/overview dashboard
- `BriefsListView` - List of briefs
- `BriefDetailView` - Single brief with tabs
- `IntakeForm` - New brief request form
- `SuccessState` - Form success confirmation
- `MonitorsView` - Monitoring dashboard
- `SourcesFeed` - Sources feed view
- `StakeholdersView` - Stakeholder matrix
- `PacksView` - Country packs

### UI Components
- `CommandPalette` - Keyboard command palette
- `Modal` - Generic modal component
- `Toast` - Notification toast
- `EmptyState` - Empty state illustration
- `Toolbar` - Action toolbar with filters
- `Table` - Data table with sorting
- `Gauge` - Confidence gauge visualization
- `Matrix` - 2D stakeholder matrix

## Shared Components

### Design System
- `Typography` - Display, body, mono text
- `Icons` - Lucide icons integration
- `Colors` - Design token colors
- `Animations` - Reveal, pulse, shimmer

### Form Components
- `Input` - Text input with validation
- `Select` - Custom select dropdown
- `Textarea` - Multi-line input
- `Checkbox` - Custom checkbox
- `FormField` - Labeled form field

## Component Hierarchy

```
App
├── LandingPage
│   ├── Nav
│   ├── Hero
│   ├── Ticker
│   ├── ProblemSection
│   ├── PipelineSection
│   ├── PSNFramework
│   ├── DashboardDemo
│   ├── PersonasSection
│   ├── RegionSection
│   ├── ProductsSection
│   └── CTABand
└── DashboardApp
    ├── AppShell
    │   ├── TopBar
    │   ├── Sidebar
    │   └── ProtoBanner
    └── Views
        ├── OverviewView
        ├── BriefsListView
        ├── BriefDetailView
        ├── IntakeForm
        ├── MonitorsView
        ├── SourcesFeed
        ├── StakeholdersView
        └── PacksView
```

## State Management

### Landing Page State
- Navigation scroll state
- Mobile menu open/close
- PSN lens selection (power/systems/narratives)
- Demo interaction state

### Dashboard State
- Current view/route
- Sidebar collapsed state
- Command palette open/close
- Modal states
- Toast notifications
- Form data and validation
- Brief data (client-side persistence)
- Monitor states
- Filter states

## Data Structures

### Brief Data
```typescript
interface Brief {
  id: string;
  title: string;
  description: string;
  confidence: number;
  createdAt: Date;
  status: 'draft' | 'in_progress' | 'complete';
  psnAnalysis: {
    power: number;
    systems: number;
    narratives: number;
  };
  keyJudgments: Array<{
    text: string;
    confidence: 'high' | 'moderate' | 'low';
    reasoning: string;
  }>;
  gaps: Array<{
    category: string;
    description: string;
    priority: number;
  }>;
  scenarios: Array<{
    name: string;
    probability: number;
    description: string;
  }>;
}
```

### Monitor Data
```typescript
interface Monitor {
  id: string;
  title: string;
  description: string;
  status: 'live' | 'paused' | 'hot';
  cadence: string;
  lastCheck: Date;
  sources: string[];
}
```

### Stakeholder Data
```typescript
interface Stakeholder {
  id: string;
  name: string;
  influence: number; // 0-100
  interest: number; // 0-100
  category: 'government' | 'private' | 'civil' | 'international';
  notes: string;
}
```
