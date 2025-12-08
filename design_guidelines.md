# Design Guidelines: Social Media Post Review & Approval Interface

## Design Approach
**System-Based Approach**: Using modern SaaS design principles inspired by Linear, Notion, and enterprise dashboards. Clean, minimalist aesthetic prioritizing clarity and workflow efficiency.

## Core Design Elements

### Typography
- **Primary Font**: Inter or SF Pro Display (Google Fonts)
- **Headings**: 600 weight, sizes: text-2xl (page titles), text-lg (section headers), text-base (card titles)
- **Body Text**: 400 weight, text-sm for post content, text-xs for metadata
- **Monospace**: For timestamps and technical data (optional accent)

### Layout System
**Spacing Units**: Consistent use of Tailwind units 4, 6, 8, 12, 16
- Component padding: p-6 to p-8
- Section spacing: gap-6, gap-8 for grids
- Container max-width: max-w-7xl for dashboard, max-w-4xl for detail page

### Component Library

**Dashboard Page Components:**
1. **Header Bar**: Logo left, user avatar/settings right, minimal top navigation
2. **Filter Bar**: Horizontal pill-style filters (Platform, Status, Date) with count badges
3. **Post Cards Grid**: 2-column layout (lg:grid-cols-2), each card containing:
   - Platform badge (top-right corner: subtle pill with icon)
   - Truncated post text preview (3-4 lines with fade)
   - Image thumbnail (if present, aspect-ratio-square, rounded)
   - Footer with scheduled date/time and status pill
   - Quick action buttons (hover state reveals)

4. **Status Indicators**: 
   - Pending: Neutral gray pill
   - Approved: Success green pill with checkmark
   - Rejected: Red pill with X icon
   - Draft: Blue outline pill

**Detail/Edit Page Components:**
1. **Breadcrumb Navigation**: Dashboard > Post Details (text-sm, linked)
2. **Post Preview Card**: Large centered card with:
   - Platform icon and name header
   - Full-size image preview (if present, max-h-96, object-cover)
   - Editable textarea (grows with content, subtle border focus state)
   - Character counter (bottom-right, color changes near limit)
   - Metadata row (scheduled date, time, auto-generated timestamp)

3. **Action Panel**: Fixed bottom bar or right sidebar containing:
   - Primary CTA: "Approve Post" (blue, prominent)
   - Secondary CTA: "Request Changes" (gray outline)
   - Destructive action: "Reject Post" (red, less prominent)
   - Back to dashboard link

4. **Confirmation Modals**: Simple centered overlays with:
   - Clear heading
   - Brief explanation text
   - Confirm/Cancel buttons (proper hierarchy)

### Visual Patterns
- **Cards**: Subtle shadow (shadow-sm), white background, rounded-lg borders
- **Hover States**: Gentle elevation increase (shadow-md), slight scale (scale-[1.01])
- **Platform Icons**: Use Font Awesome brand icons via CDN - Facebook, Instagram, LinkedIn, Twitter (X)
- **Empty States**: Centered illustration placeholder with descriptive text when no posts exist
- **Loading States**: Skeleton screens matching card structure

### Navigation & Interaction
- Dashboard cards clickable to detail page
- Smooth page transitions (no heavy animations)
- Focus states for keyboard navigation (ring-2 ring-blue-500)
- Toast notifications for actions (top-right corner, auto-dismiss)

### Responsive Behavior
- Desktop (lg): 2-column grid, sidebar navigation
- Tablet (md): 1-column grid, full-width cards
- Mobile: Stacked layout, collapsible filters, bottom action bar

### Images
**No hero images** - This is a utility-focused dashboard application. Images appear only as:
- Post content previews (user-generated social media images)
- Platform logos/icons
- Empty state illustrations (simple, line-art style)

All post preview images should have consistent aspect ratios, rounded corners (rounded-lg), and subtle borders.

### Accessibility
- ARIA labels on all interactive elements
- Semantic HTML (article tags for post cards, form elements for edit inputs)
- High contrast text (text-gray-900 on white)
- Focus indicators on all interactive elements
- Screen reader announcements for status changes