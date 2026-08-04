# Octivate Platform - Project Overview

## Objective
Surgical transfer of Octivate landing page and dashboard from static HTML to a production-ready Next.js application with Node.js backend, following the secure serving patterns from the reference implementation.

## Current State
- **Source Files**: 
  - `octivate.html` - Landing page with marketing content and PSN framework
  - `dashboard.html` - Workspace application with brief management, monitors, and stakeholder mapping
- **Reference Implementation**: nVCU\01 directory contains production server patterns with SSL support, API proxying, and static file serving

## Target Architecture
```
octatve/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with design system
│   ├── page.tsx           # Landing page (from octivate.html)
│   ├── dashboard/        # Dashboard application
│   │   └── page.tsx       # Main dashboard (from dashboard.html)
│   └── api/              # API routes for future data serving
├── components/           # React components
├── lib/                  # Utilities and design system
├── server/              # Node.js production server
│   └── server.js       # Based on server-prod.js patterns
├── public/             # Static assets
└── documentation/      # This folder
```

## Key Requirements
1. **Secure Serving**: Implement SSL-ready HTTP/HTTPS server with proxy capabilities
2. **Clean Architecture**: Minimal, robust code following reference patterns
3. **API Structure**: Prepared for internal/external API integration
4. **Routing**: Seamless navigation between landing and dashboard
5. **Design System**: Preserve the CENSII/Octivate design tokens and components

## Success Criteria
- Landing page fully functional as React components
- Dashboard workspace with all views operational
- Production server with SSL support and API proxying
- Clean codebase ready for future API integrations
- Documentation tracking all decisions and patterns
