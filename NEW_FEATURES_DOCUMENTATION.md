# 🎉 SuperU v3.0 - New Features Documentation

## Overview

Welcome to SuperU v3.0! This release adds **7 major new features** that transform SuperU into a fully-featured collaborative content management platform.

---

## 📚 Table of Contents

1. [Content Locking](#1-content-locking)
2. [Collaborative Comments](#2-collaborative-comments)
3. [Content Templates](#3-content-templates)
4. [Version Comparison](#4-version-comparison)
5. [Content Export](#5-content-export)
6. [Activity Feed](#6-activity-feed)
7. [Approval Workflow](#7-approval-workflow)

---

## 1. Content Locking 🔒

**Prevents concurrent editing conflicts by allowing only one user to edit content at a time.**

### Features
- Lock content nodes for editing
- Automatic lock expiration (default: 5 minutes)
- Lock extension for active editors
- Lock status checking

### API Endpoints

#### Acquire Lock
```bash
POST /api/locks/acquire/:node_id
Authorization: Bearer <token>

Body:
{
  "duration": 5  # Minutes (optional, default: 5)
}

Response 200:
{
  "message": "Lock acquired",
  "lock": {
    "id": "uuid",
    "node_id": "uuid",
    "locked_by": "user_uuid",
    "locked_at": "2024-01-01T00:00:00.000Z",
    "expires_at": "2024-01-01T00:05:00.000Z"
  }
}

Response 423 (Locked):
{
  "error": "Content is locked by another user",
  "code": "content_locked",
  "locked_by": "other_user_uuid",
  "expires_at": "2024-01-01T00:05:00.000Z"
}
```

#### Release Lock
```bash
DELETE /api/locks/release/:node_id
Authorization: Bearer <token>

Response 200:
{
  "message": "Lock released"
}
```

#### Check Lock Status
```bash
GET /api/locks/status/:node_id
Authorization: Bearer <token>

Response 200 (Unlocked):
{
  "locked": false
}

Response 200 (Locked):
{
  "locked": true,
  "locked_by": "user_uuid",
  "locked_at": "2024-01-01T00:00:00.000Z",
  "expires_at": "2024-01-01T00:05:00.000Z",
  "is_owner": true/false
}
```

#### Clean Up Expired Locks
```bash
POST /api/locks/cleanup
Authorization: Bearer <token>

Response 200:
{
  "message": "Expired locks cleaned up",
  "deleted_count": 5
}
```

### Frontend Integration

```javascript
// Before editing, acquire lock
const acquireLock = async (nodeId) => {
  try {
    const response = await fetch(`/api/locks/acquire/${nodeId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ duration: 5 })
    });

    if (response.status === 423) {
      const data = await response.json();
      alert(`Content is locked by another user until ${data.expires_at}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error acquiring lock:', error);
    return false;
  }
};

// When user stops editing, release lock
const releaseLock = async (nodeId) => {
  await fetch(`/api/locks/release/${nodeId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
};

// Auto-extend lock every 4 minutes while editing
let lockInterval;
const startAutoLockExtension = (nodeId) => {
  lockInterval = setInterval(async () => {
    await acquireLock(nodeId); // Extends if lock is owned
  }, 4 * 60 * 1000); // 4 minutes
};

const stopAutoLockExtension = () => {
  if (lockInterval) {
    clearInterval(lockInterval);
  }
};
```

---

## 2. Collaborative Comments 💬

**Add comments to content sections with threading, resolution, and real-time updates.**

### Features
- Add comments to any content node
- Thread replies to comments
- Resolve/unresolve comments
- Highlight specific text ranges
- Real-time comment updates via Socket.io

### API Endpoints

#### Create Comment
```bash
POST /api/comments/:node_id
Authorization: Bearer <token>

Body:
{
  "content": "This section needs clarification",
  "position": {
    "start": 100,
    "end": 150
  },  # Optional: highlighted text range
  "parent_comment_id": "uuid"  # Optional: for replies
}

Response 201:
{
  "message": "Comment created",
  "comment": {
    "id": "uuid",
    "node_id": "uuid",
    "user_id": "uuid",
    "content": "This section needs clarification",
    "position": { "start": 100, "end": 150 },
    "resolved": false,
    "created_at": "2024-01-01T00:00:00.000Z",
    "author": {
      "id": "uuid",
      "email": "user@example.com"
    }
  }
}
```

#### Get Comments for Node
```bash
GET /api/comments/:node_id?include_resolved=false
Authorization: Bearer <token>

Response 200:
{
  "comments": [
    {
      "id": "uuid",
      "node_id": "uuid",
      "user_id": "uuid",
      "content": "Main comment",
      "resolved": false,
      "created_at": "2024-01-01T00:00:00.000Z",
      "author": {
        "id": "uuid",
        "email": "user@example.com"
      },
      "replies": [
        {
          "id": "uuid",
          "content": "Reply to comment",
          "author": { "id": "uuid", "email": "other@example.com" },
          "created_at": "2024-01-01T00:05:00.000Z"
        }
      ]
    }
  ]
}
```

#### Resolve Comment
```bash
POST /api/comments/:comment_id/resolve
Authorization: Bearer <token>

Response 200:
{
  "message": "Comment resolved",
  "comment": {
    "id": "uuid",
    "resolved": true,
    "resolved_by": "user_uuid",
    "resolved_at": "2024-01-01T00:10:00.000Z"
  }
}
```

#### Update Comment
```bash
PUT /api/comments/:comment_id
Authorization: Bearer <token>

Body:
{
  "content": "Updated comment text"
}
```

#### Delete Comment
```bash
DELETE /api/comments/:comment_id
Authorization: Bearer <token>

Note: Deletes the comment and all its replies
```

### Frontend Integration

```javascript
// Socket.io events for real-time comments
socket.on('comment_added', (data) => {
  console.log('New comment:', data.comment);
  // Add comment to UI
  addCommentToUI(data.comment);
});

socket.on('comment_resolved', (data) => {
  console.log('Comment resolved:', data.comment_id);
  // Update UI
  markCommentAsResolved(data.comment_id);
});

// Add comment with text selection
const addComment = async (nodeId, text, selection) => {
  const response = await fetch(`/api/comments/${nodeId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: text,
      position: {
        start: selection.start,
        end: selection.end
      }
    })
  });

  const data = await response.json();
  return data.comment;
};
```

---

## 3. Content Templates 📋

**Create and use reusable content structures for consistent documentation.**

### Features
- Create custom templates with predefined structures
- Use templates to quickly create new content
- Share templates across teams or make them public
- Track template usage statistics

### API Endpoints

#### Create Template
```bash
POST /api/templates/create
Authorization: Bearer <token>

Body:
{
  "team_id": "uuid",
  "name": "API Documentation Template",
  "description": "Standard structure for API docs",
  "structure": [
    {
      "title": "Overview",
      "type": "section",
      "children": []
    },
    {
      "title": "Authentication",
      "type": "section",
      "children": [
        { "title": "Getting API Keys", "type": "subsection" },
        { "title": "Making Authenticated Requests", "type": "subsection" }
      ]
    },
    {
      "title": "Endpoints",
      "type": "section",
      "children": []
    }
  ],
  "is_public": false
}

Response 201:
{
  "message": "Template created",
  "template": {
    "id": "uuid",
    "team_id": "uuid",
    "name": "API Documentation Template",
    "description": "...",
    "structure": [...],
    "is_public": false,
    "usage_count": 0,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Get Team Templates
```bash
GET /api/templates/team/:team_id
Authorization: Bearer <token>

Returns: Team templates + public templates
```

#### Use Template to Create Content
```bash
POST /api/templates/use/:template_id
Authorization: Bearer <token>

Body:
{
  "team_id": "uuid",
  "title": "My New API Documentation",
  "url": "https://optional-url.com"  # Optional
}

Response 201:
{
  "message": "Content created from template",
  "content_id": "uuid",
  "template_used": "API Documentation Template"
}
```

#### Update Template
```bash
PUT /api/templates/:template_id
Authorization: Bearer <token>

Body: (any field is optional)
{
  "name": "Updated Name",
  "description": "Updated description",
  "structure": [...],
  "is_public": true
}
```

#### Delete Template
```bash
DELETE /api/templates/:template_id
Authorization: Bearer <token>

Note: Only creator or team owner can delete
```

### Example Template Structures

```javascript
// API Documentation Template
const apiTemplate = {
  name: "API Documentation",
  structure: [
    { title: "Introduction", type: "section" },
    { title: "Authentication", type: "section" },
    {
      title: "Endpoints",
      type: "section",
      children: [
        { title: "GET Endpoints", type: "subsection" },
        { title: "POST Endpoints", type: "subsection" },
        { title: "PUT/PATCH Endpoints", type: "subsection" },
        { title: "DELETE Endpoints", type: "subsection" }
      ]
    },
    { title: "Error Codes", type: "section" },
    { title: "Rate Limiting", type: "section" },
    { title: "Examples", type: "section" }
  ]
};

// User Guide Template
const userGuideTemplate = {
  name: "User Guide",
  structure: [
    { title: "Getting Started", type: "section" },
    { title: "Features", type: "section" },
    { title: "Tutorials", type: "section" },
    { title: "FAQ", type: "section" },
    { title: "Troubleshooting", type: "section" }
  ]
};
```

---

## 4. Version Comparison 🔄

**Visual diff between content versions with detailed statistics.**

### Features
- Compare any two edits
- Compare current version with previous edits
- Multiple output formats (JSON, HTML, unified diff)
- Statistics (additions, deletions, changes)
- Timeline of changes

### API Endpoints

#### Compare Two Edits
```bash
GET /api/diff/compare/:edit1_id/:edit2_id?format=json
Authorization: Bearer <token>

Formats: json, html, unified

Response 200 (JSON):
{
  "edit1": {
    "id": "uuid",
    "created_at": "2024-01-01T00:00:00.000Z",
    "user_id": "uuid"
  },
  "edit2": {
    "id": "uuid",
    "created_at": "2024-01-01T01:00:00.000Z",
    "user_id": "uuid"
  },
  "differences": [
    { "value": "unchanged text", "added": false, "removed": false },
    { "value": "removed text", "added": false, "removed": true },
    { "value": "added text", "added": true, "removed": false }
  ],
  "stats": {
    "additions": 150,
    "deletions": 50,
    "unchanged": 1000
  }
}

Response 200 (HTML):
Returns HTML with color-coded changes
```

#### Compare with Current Version
```bash
GET /api/diff/compare-current/:node_id/:edit_id?format=json
Authorization: Bearer <token>

Compares a previous edit with the current content
```

#### Get Diff Statistics Over Time
```bash
GET /api/diff/stats/:node_id
Authorization: Bearer <token>

Response 200:
{
  "node_id": "uuid",
  "total_edits": 10,
  "statistics": [
    {
      "edit_id": "uuid",
      "user_id": "uuid",
      "created_at": "2024-01-01T00:00:00.000Z",
      "additions": 100,
      "deletions": 20,
      "net_change": 80
    }
  ],
  "summary": {
    "total_additions": 500,
    "total_deletions": 100,
    "net_growth": 400
  }
}
```

### Frontend Integration

```javascript
// Visual diff component
const showDiff = async (edit1Id, edit2Id) => {
  const response = await fetch(
    `/api/diff/compare/${edit1Id}/${edit2Id}?format=html`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  const html = await response.text();
  document.getElementById('diff-viewer').innerHTML = html;
};

// Timeline of changes
const showHistory = async (nodeId) => {
  const response = await fetch(`/api/diff/stats/${nodeId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const data = await response.json();

  // Visualize with chart library
  data.statistics.forEach(stat => {
    console.log(`Edit ${stat.edit_id}: +${stat.additions} -${stat.deletions}`);
  });
};
```

---

## 5. Content Export 📥

**Export content to multiple formats for offline use and sharing.**

### Supported Formats
- **Markdown (.md)** - Plain text markdown
- **HTML (.html)** - Styled HTML document
- **JSON (.json)** - Structured data export

### API Endpoints

#### Export as Markdown
```bash
GET /api/export/:content_id/markdown
Authorization: Bearer <token>

Response: File download
Content-Type: text/markdown
Content-Disposition: attachment; filename="Document_Title.md"
```

#### Export as HTML
```bash
GET /api/export/:content_id/html
Authorization: Bearer <token>

Response: File download
Content-Type: text/html
Content-Disposition: attachment; filename="Document_Title.html"

Includes:
- Professional styling
- Responsive design
- Metadata (source URL, export date)
- Table of contents
```

#### Export as JSON
```bash
GET /api/export/:content_id/json
Authorization: Bearer <token>

Response: File download
Content-Type: application/json

Structure:
{
  "metadata": {
    "id": "uuid",
    "title": "Document Title",
    "url": "https://source.com",
    "created_at": "...",
    "updated_at": "...",
    "exported_at": "..."
  },
  "structure": {
    "id": "root_uuid",
    "title": "Document Title",
    "type": "root",
    "level": 0,
    "content": "Root content...",
    "children": [
      {
        "id": "uuid",
        "title": "Section 1",
        "type": "section",
        "level": 1,
        "content": "Section content...",
        "children": [...]
      }
    ]
  }
}
```

### Frontend Integration

```javascript
// Export content
const exportContent = (contentId, format) => {
  window.location.href = `/api/export/${contentId}/${format}?token=${token}`;
};

// Export button
<button onClick={() => exportContent(contentId, 'markdown')}>
  Export as Markdown
</button>
<button onClick={() => exportContent(contentId, 'html')}>
  Export as HTML
</button>
<button onClick={() => exportContent(contentId, 'json')}>
  Export as JSON
</button>
```

---

## 6. Activity Feed 📊

**Track and visualize team activity with detailed logs and statistics.**

### Features
- Real-time activity logging
- Filter by action type
- User-specific activity views
- Team statistics and insights
- Activity trends over time

### API Endpoints

#### Get Team Activity Feed
```bash
GET /api/activity/team/:team_id?page=1&limit=50&action_type=content_created
Authorization: Bearer <token>

Filters:
- page: Page number (default: 1)
- limit: Items per page (max: 100, default: 50)
- action_type: Filter by specific action

Response 200:
{
  "activities": [
    {
      "id": "uuid",
      "team_id": "uuid",
      "user_id": "uuid",
      "action_type": "content_created",
      "resource_type": "content",
      "resource_id": "uuid",
      "metadata": {
        "title": "New Documentation",
        "url": "https://example.com"
      },
      "created_at": "2024-01-01T00:00:00.000Z",
      "actor": {
        "id": "uuid",
        "email": "user@example.com"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

#### Get User Activity
```bash
GET /api/activity/team/:team_id/user/:user_id?page=1&limit=50
Authorization: Bearer <token>
```

#### Get Activity Statistics
```bash
GET /api/activity/team/:team_id/stats?days=7
Authorization: Bearer <token>

Response 200:
{
  "period": "Last 7 days",
  "activity_by_type": [
    { "action_type": "content_created", "count": 15 },
    { "action_type": "content_updated", "count": 45 },
    { "action_type": "member_added", "count": 3 },
    { "action_type": "comment_added", "count": 20 }
  ],
  "most_active_users": [
    {
      "user": { "id": "uuid", "email": "user@example.com" },
      "action_count": 50
    }
  ]
}
```

### Action Types

- `team_created` - Team created
- `content_created` - Content scraped/created
- `content_updated` - Content edited
- `member_added` - Team member added
- `member_removed` - Team member removed
- `comment_added` - Comment created
- `comment_resolved` - Comment resolved
- `template_created` - Template created
- `approval_requested` - Edit approval requested
- `approval_approved` - Edit approved
- `approval_rejected` - Edit rejected

### Frontend Integration

```javascript
// Activity feed component
const ActivityFeed = ({ teamId }) => {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const fetchActivities = async () => {
      const response = await fetch(`/api/activity/team/${teamId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setActivities(data.activities);
    };

    fetchActivities();
  }, [teamId]);

  return (
    <div className="activity-feed">
      {activities.map(activity => (
        <div key={activity.id} className="activity-item">
          <strong>{activity.actor.email}</strong>
          <span>{activity.action_type.replace('_', ' ')}</span>
          <span>{new Date(activity.created_at).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};
```

---

## 7. Approval Workflow ✅

**Require approval for content changes before they go live.**

### Features
- Request approval for edits
- Approve/reject with comments
- Track approval history
- Automatic content application on approval
- Pending approvals dashboard

### API Endpoints

#### Request Approval
```bash
POST /api/approvals/request/:edit_id
Authorization: Bearer <token>

Body:
{
  "comment": "Please review these changes to the API documentation"
}

Response 201:
{
  "message": "Approval requested",
  "approval": {
    "id": "uuid",
    "content_edit_id": "uuid",
    "requested_by": "uuid",
    "status": "pending",
    "comment": "Please review...",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Get Pending Approvals
```bash
GET /api/approvals/pending/:team_id
Authorization: Bearer <token>

Note: Only owners and admins can view

Response 200:
{
  "approvals": [
    {
      "id": "uuid",
      "status": "pending",
      "created_at": "2024-01-01T00:00:00.000Z",
      "requester": {
        "id": "uuid",
        "email": "user@example.com"
      },
      "ContentEdit": {
        "id": "uuid",
        "previous_content": "...",
        "new_content": "...",
        "ContentNode": {
          "id": "uuid",
          "title": "Section Title",
          "Content": {
            "id": "uuid",
            "title": "Document Title"
          }
        }
      }
    }
  ]
}
```

#### Approve or Reject
```bash
POST /api/approvals/:approval_id/:action
Authorization: Bearer <token>

Actions: approve, reject

Body:
{
  "comment": "Looks good, approved!" # Optional
}

Response 200:
{
  "message": "Edit approved",  # or "Edit rejected"
  "approval": {
    "id": "uuid",
    "status": "approved",  # or "rejected"
    "approved_by": "uuid",
    "reviewed_at": "2024-01-01T00:05:00.000Z",
    "comment": "Looks good, approved!"
  }
}
```

#### Get Approval History
```bash
GET /api/approvals/history/:content_id
Authorization: Bearer <token>

Response 200:
{
  "approvals": [
    {
      "id": "uuid",
      "status": "approved",
      "created_at": "2024-01-01T00:00:00.000Z",
      "reviewed_at": "2024-01-01T00:05:00.000Z",
      "requester": { "id": "uuid", "email": "user@example.com" },
      "reviewer": { "id": "uuid", "email": "admin@example.com" },
      "comment": "..."
    }
  ]
}
```

### Frontend Integration

```javascript
// Request approval before saving
const saveWithApproval = async (nodeId, content) => {
  // First create the edit
  const editResponse = await fetch(`/api/content/node/${nodeId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content })
  });

  const editData = await editResponse.json();

  // Request approval
  await fetch(`/api/approvals/request/${editData.edit_id}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      comment: "Please review my changes"
    })
  });

  alert('Changes submitted for approval');
};

// Admin approval dashboard
const ApprovalDashboard = ({ teamId }) => {
  const [approvals, setApprovals] = useState([]);

  const handleApprove = async (approvalId) => {
    await fetch(`/api/approvals/${approvalId}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    // Refresh list
  };

  return (
    <div>
      {approvals.map(approval => (
        <div key={approval.id}>
          <p>{approval.requester.email} requested approval</p>
          <button onClick={() => handleApprove(approval.id)}>
            Approve
          </button>
          <button onClick={() => handleReject(approval.id)}>
            Reject
          </button>
        </div>
      ))}
    </div>
  );
};
```

---

## Socket.io Events

All new features emit real-time events:

```javascript
// Content locks
socket.on('content_locked', (data) => {
  console.log('Content locked by:', data.user_id);
});

socket.on('content_unlocked', (data) => {
  console.log('Content unlocked:', data.node_id);
});

// Comments
socket.on('comment_added', (data) => {
  console.log('New comment:', data.comment);
});

socket.on('comment_resolved', (data) => {
  console.log('Comment resolved:', data.comment_id);
});

// Approvals
socket.on('approval_requested', (data) => {
  console.log('Approval requested:', data.approval_id);
});

socket.on('approval_processed', (data) => {
  console.log('Approval processed:', data.status);
});
```

---

## Installation

```bash
# Install new dependencies
cd express-backend
npm install

# Dependencies added:
# - diff (for version comparison)
# - markdown-it (for markdown processing)
# - showdown (for markdown-to-HTML conversion)
```

---

## Database Changes

New tables added:
- `content_locks` - Content locking
- `comments` - Collaborative comments
- `content_templates` - Reusable templates
- `activity_logs` - Activity tracking
- `approval_requests` - Approval workflow

**Important:** The database will auto-sync when you start the server. For production, consider using migrations.

---

## Best Practices

### Content Locking
- Always acquire lock before editing
- Release lock when done editing
- Implement auto-lock extension for long editing sessions
- Show lock status to users

### Comments
- Use position data for inline comments
- Implement comment notifications
- Allow filtering by resolved status
- Show unresolved comment count

### Templates
- Create templates for common documentation types
- Make useful templates public
- Track template effectiveness via usage_count
- Allow template customization

### Version Comparison
- Show diff before approving changes
- Visualize content growth over time
- Use HTML format for user-friendly display
- Cache diff results for performance

### Content Export
- Offer all export formats
- Include metadata in exports
- Style HTML exports professionally
- Allow batch exports

### Activity Feed
- Use for team transparency
- Implement activity notifications
- Show activity stats in dashboards
- Filter by action type for analysis

### Approval Workflow
- Require approval for critical content
- Notify approvers via email
- Track approval metrics
- Allow approval comments

---

## Troubleshooting

### Locks not releasing
- Check lock expiration time
- Run `/api/locks/cleanup` periodically
- Implement client-side lock release on page unload

### Comments not showing
- Verify Socket.io connection
- Check `include_resolved` parameter
- Ensure user has team permissions

### Templates not working
- Verify structure format is correct
- Check template permissions
- Ensure team_id is correct

### Export failing
- Check content size (very large content may timeout)
- Verify all content nodes have valid data
- Check file download permissions

### Activity not logging
- Ensure ActivityLog.logActivity is called
- Check database sync
- Verify team_id is correct

### Approvals stuck
- Check admin/owner permissions
- Verify approval status
- Check if content edit still exists

---

## Examples

See the `examples/` directory for complete frontend implementations:
- `examples/content-lock-example.html`
- `examples/comments-widget.html`
- `examples/template-creator.html`
- `examples/diff-viewer.html`
- `examples/activity-dashboard.html`
- `examples/approval-workflow.html`

---

## Performance Considerations

1. **Content Locks** - Auto cleanup expired locks periodically
2. **Comments** - Paginate comment threads for long discussions
3. **Activity Logs** - Archive old activities (>90 days)
4. **Diffs** - Cache comparison results
5. **Exports** - Queue large export requests

---

## Security Notes

- All endpoints require authentication
- Team permissions checked before access
- Lock ownership verified before release
- Only admins can approve/reject
- Activity logs are immutable

---

## Future Enhancements

Potential future features:
- AI-powered comment suggestions
- Automated approval based on rules
- Template marketplace
- Advanced analytics
- Email notifications
- Mobile app support
- Offline mode
- Content versioning branches

---

## Support

For questions or issues:
- Check the main [README.md](README.md)
- Review [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md)
- Open a GitHub issue

---

**Enjoy the new features! 🚀**
