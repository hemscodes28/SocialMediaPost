
        // --- AUTH & INITIALIZATION ---
        function checkAuth() {
            const token = localStorage.getItem('access_token');
            if (!token) {
                window.location.href = '/static/login.html';
                return null;
            }
            return token;
        }

        function resolveJobThumbUrl(imageUrl) {
            if (!imageUrl || String(imageUrl).trim() === '') return null;
            let u = String(imageUrl).trim();
            if (u.startsWith('http://') || u.startsWith('https://')) return u;
            const origin = window.location.origin;
            if (u.startsWith('/')) return origin + u;
            if (u.startsWith('uploads/')) return origin + '/' + u;
            return origin + '/uploads/' + u.replace(/^\/+/, '');
        }

        function buildJobThumbHtml(job) {
            const url = resolveJobThumbUrl(job.image_url);
            let platformIcon = '<i class="fab fa-instagram"></i>';
            let platformBg = 'linear-gradient(135deg, #f09433, #dc2743, #cc2366)';
            if (job.platform === 'linkedin') {
                platformIcon = '<i class="fab fa-linkedin-in"></i>';
                platformBg = '#0a66c2';
            } else if (job.platform === 'instagram_carousel') {
                platformIcon = '<i class="fas fa-images"></i>';
                platformBg = 'linear-gradient(135deg, #8a3ab9, #e95950)';
            } else if (job.platform === 'threads') {
                platformIcon = '<img src="/static/assets/threads.svg" style="width:1.2rem;height:1.2rem;" alt="Threads">';
                platformBg = '#000000';
            }
            if (url) {
                const safeUrl = url.replace(/"/g, '&quot;');
                const plat = (job.platform || 'instagram').replace(/"/g, '');
                return `<div class="job-thumbnail-wrap" data-platform="${plat}"><img src="${safeUrl}" class="job-thumbnail" alt="" onerror="handleThumbError(this)"></div>`;
            }
            return `<div class="job-thumbnail-wrap"><div class="history-thumb-icon" style="background:${platformBg};color:white;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">${platformIcon}</div></div>`;
        }
        window.handleThumbError = function (img) {
            const platform = img.closest('.job-thumbnail-wrap')?.dataset?.platform || 'instagram';
            img.parentElement.innerHTML = window.getJobThumbFallbackHtml(platform);
        };
        window.getJobThumbFallbackHtml = function (platform) {
            if (platform === 'linkedin') {
                return '<div class="history-thumb-icon" style="background:#0a66c2;color:white;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;"><i class="fab fa-linkedin-in"></i></div>';
            } else if (platform === 'threads') {
                return '<div class="history-thumb-icon" style="background:#000000;color:white;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;"><img src="/static/assets/threads.svg" style="width:1.5rem;height:1.5rem;filter:invert(1);" alt="Threads"></div>';
            }
            return '<div class="history-thumb-icon" style="background:linear-gradient(135deg,#f09433,#dc2743);color:white;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;"><i class="fab fa-instagram"></i></div>';
        };

        async function fetchWithAuth(url, options = {}) {
            const token = localStorage.getItem('access_token');
            if (!token) {
                window.location.href = '/static/login.html';
                return null;
            }
            options.headers = options.headers || {};
            options.headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch(url, options);
            if (response.status === 401) {
                localStorage.removeItem('access_token');
                window.location.href = '/static/login.html';
                return null;
            }
            return response;
        }

        let currentUserId = null;
        let globalInstagramAccounts = [];
        let globalLinkedInAccounts = [];
        let globalThreadsAccounts = [];
        window.addEventListener('message', (ev) => {
            if (ev.data === 'platform_connected') {
                fetchInstagramAccount();
                updateProfileDashboard();
                showToast('Instagram account connected!', 'success');
            }
            if (ev.data?.type === 'platform_connect_failed' && ev.data.platform === 'instagram') {
                showToast('Instagram connection failed. Check the popup for setup steps.', 'error');
            }
        });

        async function init() {
            const token = checkAuth();
            if (!token) return;

            // Set Date
            const now = new Date();
            const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
            const dateEl = document.getElementById('profileCurrentDate');
            if (dateEl) {
                dateEl.textContent = now.toLocaleDateString('en-US', dateOptions);
            }

            // Show a fallback name immediately from token payload while API loads
            try {
                const payloadB64 = token.split('.')[1];
                if (payloadB64) {
                    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
                    const emailFallback = payload.sub || '';
                    if (emailFallback) {
                        const nameFallback = emailFallback.split('@')[0];
                        const userNameEl = document.getElementById('userName');
                        const avatarEl = document.getElementById('avatarInitial');
                        const userProfileEl = document.getElementById('userProfile');
                        if (userNameEl) userNameEl.textContent = nameFallback;
                        if (avatarEl) avatarEl.textContent = nameFallback.charAt(0).toUpperCase();
                        if (userProfileEl) userProfileEl.style.display = 'flex';
                        const welcomeNameEl = document.getElementById('welcomeName');
                        if (welcomeNameEl) {
                            welcomeNameEl.textContent = nameFallback;
                            welcomeNameEl.classList.remove('skeleton-text');
                            welcomeNameEl.style.cssText = 'background:transparent;width:auto;height:auto;display:inline;';
                        }
                    }
                }
            } catch (_) { /* ignore token parse errors */ }

            try {
                const resp = await fetchWithAuth('/api/auth/me');
                if (resp && resp.ok) {
                    const user = await resp.json();
                    currentUserId = user.id;
                    const fullName = user.full_name || user.email || 'User';
                    const firstName = fullName.split(' ')[0];

                    const userNameEl = document.getElementById('userName');
                    const avatarEl = document.getElementById('avatarInitial');
                    const userProfileEl = document.getElementById('userProfile');
                    if (userNameEl) userNameEl.textContent = fullName;
                    if (avatarEl) avatarEl.textContent = fullName.charAt(0).toUpperCase();
                    if (userProfileEl) userProfileEl.style.display = 'flex';

                    const welcomeNameEl = document.getElementById('welcomeName');
                    if (welcomeNameEl) {
                        welcomeNameEl.textContent = firstName;
                        welcomeNameEl.classList.remove('skeleton-text');
                        welcomeNameEl.style.cssText = 'background:transparent;width:auto;height:auto;display:inline;';
                    }
                } else {
                    console.error("fetchWithAuth('/api/auth/me') returned non-ok", resp);
                }
            } catch (e) {
                console.error("Error fetching me:", e);
            }

            await Promise.all([
                fetchLinkedInAccounts(),
                fetchInstagramAccount(),
                fetchThreadsAccounts(),
                fetchScheduledJobs(),
                updateProfileDashboard()
            ]);

            const tabParam = new URLSearchParams(window.location.search).get('tab');
            switchTab(tabParam && document.getElementById(tabParam) ? tabParam : 'profile');

            // Real-time caption listeners
            const instaCapEl = document.getElementById('instaCaption');
            const linkedinCapEl = document.getElementById('linkedinCaption');
            const threadsCapEl = document.getElementById('threadsCaption');
            if (instaCapEl) instaCapEl.addEventListener('input', updateInpagePreview);
            if (linkedinCapEl) linkedinCapEl.addEventListener('input', updateInpagePreview);
            if (threadsCapEl) threadsCapEl.addEventListener('input', updateInpagePreview);
        }

        // --- TAB MANAGEMENT ---
        function switchTab(tabId) {
            document.querySelectorAll('.nav-item').forEach(n => {
                if (n.dataset.tab === tabId) {
                    n.classList.add('active');
                } else {
                    n.classList.remove('active');
                }
            });
            document.querySelectorAll('.tab-content').forEach(t => {
                if (t.id === tabId) {
                    t.classList.add('active');
                } else {
                    t.classList.remove('active');
                }
            });
            if (tabId === 'profile') {
                updateProfileDashboard();
            }
        }
        window.switchTab = switchTab;

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                switchTab(item.dataset.tab);
            });
        });

        // Profile Wing Navigation
        document.getElementById('userProfile').onclick = () => {
            switchTab('profile');
        };

        // --- PLATFORM LOGIC ---
        async function fetchInstagramAccount() {
            try {
                const resp = await fetchWithAuth('/api/platforms/instagram/accounts');
                if (!resp) return;
                const accounts = await resp.json();
                globalInstagramAccounts = accounts || [];
                const badge = document.getElementById('instaBadge');
                const label = document.getElementById('instaUserLabel');
                const btn = document.getElementById('addInstaAccount');
                const select = document.getElementById('instagramAccounts');
                const selectedIgAccounts = JSON.parse(localStorage.getItem('selected_instagram_accounts') || '[]');

                if (select) {
                    select.innerHTML = '';
                }

                const listContainer = document.getElementById('instagramAccountsList');
                if (listContainer) {
                    listContainer.innerHTML = '';
                }

                if (accounts && accounts.length > 0) {
                    badge.textContent = 'Active';
                    badge.className = 'job-status status-published';
                    label.textContent = `${accounts.length} Instagram account(s) connected`;
                    btn.textContent = 'Add Instagram Account';
                    btn.className = 'btn btn-glass';

                    accounts.forEach(acc => {
                        // Checkbox
                        if (select) {
                            const div = document.createElement('div');
                            div.style.display = 'flex';
                            div.style.alignItems = 'center';
                            div.style.gap = '8px';
                            div.style.padding = '4px 0';
                            const checked = selectedIgAccounts.some(id => id == acc.instagram_account_id) ? 'checked' : '';
                            div.innerHTML = `
                                <input type="checkbox" name="instagramAccountsCheckbox" value="${acc.instagram_account_id}" id="ig_chk_${acc.instagram_account_id}_${acc.username.replace(/\./g, '_')}" style="cursor: pointer; accent-color: var(--primary);" ${checked}>
                                <label for="ig_chk_${acc.instagram_account_id}_${acc.username.replace(/\./g, '_')}" style="cursor: pointer; font-size: 0.85rem; color: var(--text-main);">@${acc.username}</label>
                            `;
                            select.appendChild(div);
                        }

                        // Connection List Card with Disconnect/Trash Button
                        if (listContainer) {
                            const item = document.createElement('div');
                            item.className = 'acc-item';
                            item.style.display = 'flex';
                            item.style.justifyContent = 'space-between';
                            item.style.alignItems = 'center';
                            item.style.margin = '4px 0';
                            item.innerHTML = `
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-check-circle" style="color: #4caf50;"></i>
                                    <span>@${acc.username}</span>
                                </div>
                                <button class="btn-disconnect-insta" data-id="${acc.instagram_account_id}" data-username="${acc.username}" style="background: none; border: none; color: #ff5252; cursor: pointer; padding: 4px 8px; font-size: 0.85rem; display: flex; align-items: center;">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            `;
                            listContainer.appendChild(item);
                        }
                    });

                    // Add click handlers for delete buttons
                    if (listContainer) {
                        listContainer.querySelectorAll('.btn-disconnect-insta').forEach(btnEl => {
                            btnEl.onclick = async (e) => {
                                e.stopPropagation();
                                const accountId = btnEl.getAttribute('data-id');
                                const username = btnEl.getAttribute('data-username');
                                const confirmDelete = confirm(`Disconnect Instagram account @${username}?`);
                                if (confirmDelete) {
                                    try {
                                        const delResp = await fetchWithAuth(`/api/platforms/instagram/accounts/${accountId}?username=${encodeURIComponent(username)}`, { method: 'DELETE' });
                                        if (delResp && delResp.ok) {
                                            showToast('Instagram account disconnected.', 'success');
                                            fetchInstagramAccount();
                                            updateProfileDashboard();
                                        } else {
                                            showToast('Failed to disconnect account.', 'error');
                                        }
                                    } catch (err) {
                                        showToast('Error disconnecting account.', 'error');
                                    }
                                }
                            };
                        });
                    }
                } else {
                    badge.textContent = 'Disconnected';
                    badge.className = 'job-status status-failed';
                    label.textContent = 'Connect a Business or Creator Instagram via Facebook (Meta). Use Add Instagram Account to sign in.';
                    btn.textContent = 'Add Instagram Account';
                    btn.className = 'btn btn-primary';
                    if (select) {
                        select.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; padding: 4px;">No accounts connected</div>';
                    }
                }

                if (select) {
                    select.querySelectorAll('input[name="instagramAccountsCheckbox"]').forEach(box => {
                        box.addEventListener('change', () => {
                            const selected = Array.from(select.querySelectorAll('input[name="instagramAccountsCheckbox"]:checked')).map(b => b.value);
                            localStorage.setItem('selected_instagram_accounts', JSON.stringify(selected));
                        });
                    });
                }
            } catch (e) {
                console.error("Instagram load failed:", e);
            }
        }

        async function fetchLinkedInAccounts() {
            try {
                const resp = await fetchWithAuth('/api/platforms/linkedin/accounts');
                if (!resp) return;
                const accounts = await resp.json();
                globalLinkedInAccounts = Array.isArray(accounts) ? accounts : (accounts.accounts || []);
                const selectedLiAccounts = JSON.parse(localStorage.getItem('selected_linkedin_accounts') || '[]');

                // Select in Publisher
                const select = document.getElementById('linkedinAccounts');
                if (select) {
                    select.innerHTML = '';
                }

                // List in Connections Tab
                const listContainer = document.getElementById('linkedInAccountsList');
                listContainer.innerHTML = '';

                const list = Array.isArray(accounts) ? accounts : (accounts.accounts || []);
                if (list.length > 0) {
                    list.forEach(acc => {
                        // Checkbox
                        if (select) {
                            const div = document.createElement('div');
                            div.style.display = 'flex';
                            div.style.alignItems = 'center';
                            div.style.gap = '8px';
                            div.style.padding = '4px 0';
                            const liId = acc.member_urn.replace(/:/g, '_');
                            const checked = selectedLiAccounts.includes(acc.member_urn) ? 'checked' : '';
                            div.innerHTML = `
                                <input type="checkbox" name="linkedinAccountsCheckbox" value="${acc.member_urn}" id="li_chk_${liId}" style="cursor: pointer; accent-color: var(--primary);" ${checked}>
                                <label for="li_chk_${liId}" style="cursor: pointer; font-size: 0.85rem; color: var(--text-main);">${acc.name}</label>
                            `;
                            select.appendChild(div);
                        }

                        // Connection List Card with delete action
                        const item = document.createElement('div');
                        item.className = 'acc-item';
                        const urnSafe = encodeURIComponent(acc.member_urn);
                        item.innerHTML = `
                            <i class="fas fa-check-circle"></i>
                            <span style="flex:1">${acc.name}</span>
                            <button class="btn btn-ghost btn-sm li-delete" data-urn="${urnSafe}" style="margin-left:8px">Remove</button>
                        `;
                        listContainer.appendChild(item);
                        // Attach delete handler
                        item.querySelectorAll('.li-delete').forEach(btn => {
                            btn.addEventListener('click', async (ev) => {
                                ev.preventDefault();
                                const urn = decodeURIComponent(btn.dataset.urn);
                                if (!confirm('Remove this LinkedIn profile from your account?')) return;
                                try {
                                    const res = await fetchWithAuth(`/api/platforms/linkedin/accounts/${encodeURIComponent(urn)}`, { method: 'DELETE' });
                                    if (res && res.ok) {
                                        showToast('LinkedIn account removed', 'success');
                                        fetchLinkedInAccounts();
                                        updateProfileDashboard();
                                    } else {
                                        const body = res ? await res.json().catch(() => ({})) : {};
                                        showToast((body.detail || 'Failed to remove LinkedIn account'), 'error');
                                    }
                                } catch (err) {
                                    console.error('Delete LinkedIn account failed', err);
                                    showToast('Failed to remove LinkedIn account', 'error');
                                }
                            });
                        });
                    });
                } else {
                    if (select) {
                        select.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; padding: 4px;">No profiles connected</div>';
                    }
                }

                if (select) {
                    select.querySelectorAll('input[name="linkedinAccountsCheckbox"]').forEach(box => {
                        box.addEventListener('change', () => {
                            const selected = Array.from(select.querySelectorAll('input[name="linkedinAccountsCheckbox"]:checked')).map(b => b.value);
                            localStorage.setItem('selected_linkedin_accounts', JSON.stringify(selected));
                        });
                    });
                }
            } catch (e) {
                console.error("LinkedIn load failed:", e);
            }
        }

        // --- ANALYTICS & DASHBOARD STATS ---
        let globalJobs = [];
        let historyRange = 'week';

        async function updateProfileDashboard() {
            try {
                // 1. Fetch Instagram Account Details
                let igAccs = [];
                try {
                    const igResp = await fetchWithAuth('/api/platforms/instagram/accounts/detailed');
                    if (igResp && igResp.ok) {
                        igAccs = await igResp.json();
                    }
                } catch (err) {
                    console.error("Error loading detailed Instagram account info:", err);
                }

                // 2. Fetch LinkedIn Account Details
                let liAccs = [];
                try {
                    const liResp = await fetchWithAuth('/api/platforms/linkedin/accounts/detailed');
                    if (liResp && liResp.ok) {
                        const res = await liResp.json();
                        liAccs = Array.isArray(res) ? res : (res.accounts || []);
                    }
                } catch (err) {
                    console.error("Error loading LinkedIn account info:", err);
                }

                // 2.5 Fetch Threads Account Details
                let threadsAccs = [];
                try {
                    const threadsResp = await fetchWithAuth('/api/platforms/threads/accounts/detailed');
                    if (threadsResp && threadsResp.ok) {
                        threadsAccs = await threadsResp.json();
                    }
                } catch (err) {
                    console.error("Error loading Threads account info:", err);
                }

                // 3. Fetch Jobs & Render Post History & Analytics
                const jobsResp = await fetchWithAuth('/api/jobs');
                if (jobsResp && jobsResp.ok) {
                    globalJobs = await jobsResp.json();
                }
                
                const published = globalJobs.filter(j => j.status === 'published').length;
                const scheduled = globalJobs.filter(j => j.status === 'pending').length;
                const failed = globalJobs.filter(j => j.status === 'failed').length;
                
                const totalAttempted = published + failed;
                const successRate = totalAttempted > 0 ? Math.round((published / totalAttempted) * 100) : 0;
                
                // Update stats counters
                document.getElementById('profileStatPublished').textContent = published;
                document.getElementById('profileStatScheduled').textContent = scheduled;
                document.getElementById('profileStatRate').textContent = successRate + '%';

                // Now render the dynamic profile accounts grid
                const grid = document.querySelector('.profile-accounts-grid');
                if (grid) {
                    grid.innerHTML = '';

                    // 1. Render Instagram Accounts
                    if (igAccs && igAccs.length > 0) {
                        igAccs.forEach(acc => {
                            const card = document.createElement('div');
                            card.className = 'profile-account-card';
                            
                            const picHtml = acc.profile_picture_url 
                                ? `<img src="${acc.profile_picture_url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
                                : `<i class="fab fa-instagram"></i>`;
                                
                            card.innerHTML = `
                                <div class="profile-account-header">
                                    <div class="profile-pic-placeholder" style="background: linear-gradient(135deg, #f09433, #dc2743, #cc2366);">
                                        ${picHtml}
                                    </div>
                                    <div class="profile-meta">
                                        <h3>${escapeHtml(acc.name || '@' + acc.username)}</h3>
                                        <p>@${escapeHtml(acc.username)}</p>
                                    </div>
                                    <span class="job-status status-published profile-status-badge">Connected</span>
                                </div>
                                <div class="profile-stats-row" style="display: flex;">
                                    <div class="profile-stat">
                                        <span class="stat-num">${acc.followers_count.toLocaleString()}</span>
                                        <span class="stat-lbl">Followers</span>
                                    </div>
                                    <div class="profile-stat">
                                        <span class="stat-num">${acc.follows_count.toLocaleString()}</span>
                                        <span class="stat-lbl">Following</span>
                                    </div>
                                    <div class="profile-stat">
                                        <span class="stat-num">${acc.media_count.toLocaleString()}</span>
                                        <span class="stat-lbl">Posts</span>
                                    </div>
                                </div>
                                <p class="profile-bio">${escapeHtml(acc.biography || 'No biography set.')}</p>
                            `;
                            grid.appendChild(card);
                        });
                    } else {
                        // Render Instagram Placeholder
                        const card = document.createElement('div');
                        card.className = 'profile-account-card';
                        card.innerHTML = `
                            <div class="profile-account-header">
                                <div class="profile-pic-placeholder" style="background: linear-gradient(135deg, #f09433, #dc2743, #cc2366);">
                                    <i class="fab fa-instagram"></i>
                                </div>
                                <div class="profile-meta">
                                    <h3>Not Connected</h3>
                                    <p>Connect Instagram to view profile</p>
                                </div>
                                <span class="job-status status-failed profile-status-badge">Disconnected</span>
                            </div>
                            <p class="profile-bio">Link your Instagram Business or Creator account to view live profile data.</p>
                        `;
                        grid.appendChild(card);
                    }

                    // 2. Render LinkedIn Accounts
                    if (liAccs && liAccs.length > 0) {
                        liAccs.forEach(acc => {
                            const card = document.createElement('div');
                            card.className = 'profile-account-card';
                            
                            const picHtml = acc.picture 
                                ? `<img src="${acc.picture}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
                                : `<i class="fab fa-linkedin-in"></i>`;
                                
                            const linkedinJobs = globalJobs.filter(j => j.status === 'published' && j.platform === 'linkedin');
                            const fallbackCount = linkedinJobs.filter(j => {
                                if (j.member_urn) {
                                    return j.member_urn === acc.member_urn;
                                }
                                return true;
                            }).length;
                            const liPublished = typeof acc.post_count === 'number' ? acc.post_count : fallbackCount;
                            const liBio = acc.post_count_error
                                ? 'Live LinkedIn post count unavailable due to permission restrictions. Showing app-published posts instead.'
                                : 'Professional Member & Content Creator. Connected to Post Pilot.ai';

                            card.innerHTML = `
                                <div class="profile-account-header">
                                    <div class="profile-pic-placeholder" style="background: #0a66c2;">
                                        ${picHtml}
                                    </div>
                                    <div class="profile-meta">
                                        <h3>${escapeHtml(acc.name || 'LinkedIn Member')}</h3>
                                        <p>LinkedIn Profile</p>
                                    </div>
                                    <span class="job-status status-published profile-status-badge">Connected</span>
                                </div>
                                <div class="profile-quote" style="margin: 18px 0 12px;">
                                <p>Grow your professional presence with AI-powered LinkedIn publishing.</p>
                            </div>
                                <p class="profile-bio">${escapeHtml(liBio)}</p>
                            `;
                            grid.appendChild(card);
                        });
                    } else {
                        // Render LinkedIn Placeholder
                        const card = document.createElement('div');
                        card.className = 'profile-account-card';
                        card.innerHTML = `
                            <div class="profile-account-header">
                                <div class="profile-pic-placeholder" style="background: #0a66c2;">
                                    <i class="fab fa-linkedin-in"></i>
                                </div>
                                <div class="profile-meta">
                                    <h3>Not Connected</h3>
                                    <p>Connect LinkedIn to view profile</p>
                                </div>
                                <span class="job-status status-failed profile-status-badge">Disconnected</span>
                            </div>
                            <p class="profile-bio">Professional Member &amp; Content Creator. Connect your LinkedIn profile to see publishing history.</p>
                        `;
                        grid.appendChild(card);
                    }

                    // 3. Render Threads Accounts
                    if (threadsAccs && threadsAccs.length > 0) {
                        threadsAccs.forEach(acc => {
                            const card = document.createElement('div');
                            card.className = 'profile-account-card';
                            
                            card.innerHTML = `
                                <div class="profile-account-header">
                                    <div class="profile-pic-placeholder" style="background: #000; color: #fff;">
                                        <img src="/static/assets/threads.svg" style="width: 24px; height: 24px; filter: invert(1);" alt="Threads">
                                    </div>
                                    <div class="profile-meta">
                                        <h3>${escapeHtml(acc.name || '@' + acc.username)}</h3>
                                        <p>@${escapeHtml(acc.username)}</p>
                                    </div>
                                    <span class="job-status status-published profile-status-badge">Connected</span>
                                </div>
                                <div class="profile-stats-row" style="display: flex;">
                                    <div class="profile-stat">
                                        <span class="stat-num">${acc.followers_count.toLocaleString()}</span>
                                        <span class="stat-lbl">Followers</span>
                                    </div>
                                    <div class="profile-stat">
                                        <span class="stat-num">${acc.threads_count.toLocaleString()}</span>
                                        <span class="stat-lbl">Threads</span>
                                    </div>
                                </div>
                                <p class="profile-bio">${escapeHtml(acc.biography || 'Meta Threads Account')}</p>
                            `;
                            grid.appendChild(card);
                        });
                    } else {
                        // Render Threads Placeholder
                        const card = document.createElement('div');
                        card.className = 'profile-account-card';
                        card.innerHTML = `
                            <div class="profile-account-header">
                                <div class="profile-pic-placeholder" style="background: #000; color: #fff;">
                                    <img src="/static/assets/threads.svg" style="width: 24px; height: 24px; filter: invert(1);" alt="Threads">
                                </div>
                                <div class="profile-meta">
                                    <h3>Not Connected</h3>
                                    <p>Connect Threads to view profile</p>
                                </div>
                                <span class="job-status status-failed profile-status-badge">Disconnected</span>
                            </div>
                            <p class="profile-bio">Connect your Meta Threads account to see dashboard stats and metrics.</p>
                        `;
                        grid.appendChild(card);
                    }
                }

                // Render History Feed
                renderPostHistory();
            } catch (e) {
                console.error("Error updating profile dashboard:", e);
            }
        }


        function initDualNavHover() {
            const container = document.getElementById('dualNavBox');
            const leftCard = document.getElementById('dualLeft');
            const rightCard = document.getElementById('dualRight');
            if(!container || !leftCard || !rightCard) return;

            leftCard.addEventListener('mouseenter', () => container.classList.add('selected-left'));
            leftCard.addEventListener('mouseleave', () => container.classList.remove('selected-left'));
            
            rightCard.addEventListener('mouseenter', () => container.classList.add('selected-right'));
            rightCard.addEventListener('mouseleave', () => container.classList.remove('selected-right'));
        }


        function setHistoryRange(range) {
            historyRange = range;
            const weekBtn = document.getElementById('rangeWeek');
            const monthBtn = document.getElementById('rangeMonth');
            if (weekBtn) weekBtn.classList.toggle('active', range === 'week');
            if (monthBtn) monthBtn.classList.toggle('active', range === 'month');
            renderPostHistory();
        }
        window.setHistoryRange = setHistoryRange;

        function renderPostHistory() {
            const container = document.getElementById('profilePostHistory');
            if (!container) return;

            // Only show published, running, or failed
            const historyJobs = globalJobs.filter(j => j.status !== 'pending' && j.status !== 'cancelled');
            
            // Filter by date range
            const now = new Date();
            const filteredJobs = historyJobs.filter(j => {
                const jobDate = new Date(j.scheduled_at);
                const diffTime = Math.abs(now - jobDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (historyRange === 'week') {
                    return diffDays <= 7;
                } else if (historyRange === 'month') {
                    return diffDays <= 30;
                }
                return true;
            });

            if (filteredJobs.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 60px; color: var(--text-dim);">
                        <i class="fas fa-clock" style="font-size: 2rem; margin-bottom: 16px; opacity: 0.3; display: block;"></i>
                        <p>No post history found for this period.</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = '';
            filteredJobs.forEach(job => {
                const item = document.createElement('div');
                item.className = 'history-item';
                item.onclick = () => openHistoryDetailModal(job);

                // Platform Icon / Color
                let platformIcon = '<i class="fab fa-instagram"></i>';
                let platformBg = 'linear-gradient(135deg, #f09433, #dc2743, #cc2366)';
                let platformLabel = 'Instagram';
                if (job.platform === 'linkedin') {
                    platformIcon = '<i class="fab fa-linkedin-in"></i>';
                    platformBg = '#0a66c2';
                    platformLabel = 'LinkedIn';
                } else if (job.platform === 'instagram_carousel') {
                    platformIcon = '<i class="fas fa-images"></i>';
                    platformBg = 'linear-gradient(135deg, #8a3ab9, #e95950)';
                    platformLabel = 'Instagram Carousel';
                } else if (job.platform === 'threads') {
                    platformIcon = '<img src="/static/assets/threads.svg" style="width:1.1rem;height:1.1rem;vertical-align:middle;" alt="Threads">';
                    platformBg = '#000000';
                    platformLabel = 'Threads';
                }

                const mediaHtml = buildJobThumbHtml(job).replace('job-thumbnail-wrap', 'job-thumbnail-wrap history-thumb-slot').replace('job-thumbnail', 'history-thumb');

                // Caption
                const rawCaption = job.caption || 'No caption';
                const previewCaption = rawCaption.length > 70 ? `${rawCaption.slice(0, 68)}...` : rawCaption;
                // Status Badge
                let statusBadgeClass = 'status-published';
                if (job.status === 'failed') {
                    statusBadgeClass = 'status-failed';
                } else if (job.status === 'running') {
                    statusBadgeClass = 'status-running';
                }

                const dateStr = new Date(job.scheduled_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                item.innerHTML = `
                    ${mediaHtml}
                    <div class="history-info">
                        <strong>${escapeHtml(platformLabel)} • ${job.status.toUpperCase()}</strong>
                        <span>${dateStr}</span>
                        <span>${escapeHtml(previewCaption)}</span>
                    </div>
                    <span class="job-status ${statusBadgeClass}" style="flex-shrink: 0;">${job.platform.toUpperCase()}</span>
                `;
                container.appendChild(item);
            });
        }

        function openHistoryDetailModal(job) {
            const modal = document.getElementById('historyDetailModal');
            const img = document.getElementById('hmImage');
            const caption = document.getElementById('hmCaption');
            const meta = document.getElementById('hmMeta');

            if (!modal) return;

            // Media
            const thumbUrl = resolveJobThumbUrl(job.image_url);
            if (thumbUrl) {
                img.src = thumbUrl;
                img.style.display = 'block';
                img.onerror = () => { img.style.display = 'none'; };
            } else {
                img.style.display = 'none';
            }

            // Caption
            caption.innerHTML = renderHashtagsAsHtml(job.caption || 'No caption available.');

            // Meta row
            let platformIcon = '<i class="fab fa-instagram"></i>';
            let platformLabel = 'Instagram';
            if (job.platform === 'linkedin') {
                platformIcon = '<i class="fab fa-linkedin-in"></i>';
                platformLabel = 'LinkedIn';
            } else if (job.platform === 'instagram_carousel') {
                platformIcon = '<i class="fas fa-images"></i>';
                platformLabel = 'Instagram Carousel';
            } else if (job.platform === 'threads') {
                platformIcon = '<img src="/static/assets/threads.svg" style="width:1.1rem;height:1.1rem;vertical-align:middle;" alt="Threads">';
                platformLabel = 'Threads';
            }

            let statusColor = 'var(--success)';
            if (job.status === 'failed') statusColor = '#ff5252';
            else if (job.status === 'running') statusColor = 'var(--primary)';

            const scheduledAt = job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : 'Unknown';
            const captionCount = job.caption ? `${job.caption.split(/\s+/).length} words` : 'No caption';
            const imageInfo = job.image_url ? 'Media attached' : 'No media attached';

            meta.innerHTML = `
                <span class="hm-chip">${platformIcon} ${platformLabel}</span>
                <span class="hm-chip"><i class="fas fa-calendar-alt"></i> ${scheduledAt}</span>
                <span class="hm-chip"><i class="fas fa-info-circle"></i> Status: <span style="color: ${statusColor}; font-weight: 700;">${job.status.toUpperCase()}</span></span>
                <span class="hm-chip"><i class="fas fa-font"></i> ${escapeHtml(captionCount)}</span>
                <span class="hm-chip"><i class="fas fa-photo-video"></i> ${escapeHtml(imageInfo)}</span>
            `;

            if (job.status === 'failed' && job.error) {
                meta.innerHTML += `
                    <span class="hm-chip" style="background: rgba(255,82,82,0.1); color: #ff5252; border-color: rgba(255,82,82,0.2); width: 100%;">
                        <i class="fas fa-exclamation-triangle"></i> Error: ${escapeHtml(job.error)}
                    </span>
                `;
            }

            modal.classList.add('open');
        }
        window.openHistoryDetailModal = openHistoryDetailModal;

        // Wire up close events for History Modal
        document.getElementById('historyCloseBtn').onclick = () => {
            document.getElementById('historyDetailModal').classList.remove('open');
        };
        document.getElementById('historyDetailModal').onclick = (e) => {
            if (e.target === document.getElementById('historyDetailModal')) {
                document.getElementById('historyDetailModal').classList.remove('open');
            }
        };

        // --- MEDIA UPLOAD ---
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const fileImg = document.getElementById('filePreviewImg');
        const placeholder = document.getElementById('uploadPlaceholder');
        const gallery = document.getElementById('mediaGallery');
        const galleryCount = document.getElementById('galleryCount');
        const removeBtn = document.getElementById('removeMediaBtn');
        const previewBtn = document.getElementById('previewBtn');

        dropZone.onclick = (e) => {
            if (e.target.closest('#removeMediaBtn')) return;
            fileInput.click();
        };

        function resetPublisherForm() {
            fileInput.value = '';
            fileImg.style.display = 'none';
            fileImg.removeAttribute('src');
            placeholder.style.display = 'block';
            if (gallery) gallery.style.display = 'none';
            if (galleryCount) galleryCount.style.display = 'none';
            dropZone.classList.remove('has-file');
            // Hide 160px composer thumbnail
            const previewArea = document.getElementById('composerMediaPreviewArea');
            const previewImg = document.getElementById('composerImagePreviewImg');
            if (previewArea) previewArea.style.display = 'none';
            if (previewImg) previewImg.removeAttribute('src');
            // Hide AI Magic thumbnail
            if (aiMagicThumbnailContainer) aiMagicThumbnailContainer.style.display = 'none';
            if (aiMagicThumbnailImg) aiMagicThumbnailImg.removeAttribute('src');
            const instaCap = document.getElementById('instaCaption');
            const liCap = document.getElementById('linkedinCaption');
            const threadsCap = document.getElementById('threadsCaption');
            if (instaCap) instaCap.value = '';
            if (liCap) liCap.value = '';
            if (threadsCap) threadsCap.value = '';
            const schedTime = document.getElementById('scheduleTime');
            if (schedTime) schedTime.value = '';
            const schedSection = document.getElementById('scheduleSection');
            const schedToggle = document.getElementById('scheduleToggle');
            if (typeof isScheduleActive !== 'undefined' && isScheduleActive) {
                isScheduleActive = false;
                if (schedSection) schedSection.style.display = 'none';
                if (schedToggle) {
                    schedToggle.classList.remove('active');
                    schedToggle.style.color = '';
                }
            }
            // Clear unified composer editor
            const unifiedEditor = document.getElementById('composerMainEditor');
            if (unifiedEditor) unifiedEditor.value = '';
            // Reset AI slides back to welcome
            const slideWelcome = document.getElementById('aiSlideWelcome');
            const slidePrompt = document.getElementById('aiSlidePrompt');
            const slideRefine = document.getElementById('aiSlideRefine');
            if (slideWelcome) slideWelcome.style.display = 'block';
            if (slidePrompt) slidePrompt.style.display = 'none';
            if (slideRefine) slideRefine.style.display = 'none';
            // Reset AI prompt input
            const promptInput = document.getElementById('aiPromptInput');
            if (promptInput) promptInput.value = '';
            updateUIState();
            if (typeof updateInpagePreview === 'function') updateInpagePreview();
        }

        removeBtn.onclick = (e) => {
            e.stopPropagation();
            resetPublisherForm();
        };

        // Wire composerRemovePreviewBtn (✕ on 160px large preview thumbnail)
        const composerRemovePreviewBtn = document.getElementById('composerRemovePreviewBtn');
        if (composerRemovePreviewBtn) {
            composerRemovePreviewBtn.onclick = (e) => {
                e.stopPropagation();
                resetPublisherForm();
            };
        }

        fileInput.onchange = (e) => {
            handleFiles(e.target.files);
        };

        dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; };
        dropZone.ondragleave = () => { dropZone.style.borderColor = 'var(--border)'; };
        dropZone.ondrop = (e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
        };

        function handleFiles(files) {
            if (!files || files.length === 0) return;

            const fileList = Array.from(files);

            // Primary Preview (small dropzone thumb)
            const reader = new FileReader();
            reader.onload = (e) => {
                fileImg.src = e.target.result;
                fileImg.style.display = 'block';
                placeholder.style.display = 'none';
                dropZone.classList.add('has-file');

                // === 160px Composer Thumbnail Preview (Fix 2) ===
                const previewArea = document.getElementById('composerMediaPreviewArea');
                const previewImg = document.getElementById('composerImagePreviewImg');
                if (previewArea && previewImg) {
                    previewImg.src = e.target.result;
                    previewArea.style.display = 'flex';
                }
                // Sync AI Magic thumbnail
                if (aiMagicThumbnailImg && aiMagicThumbnailContainer) {
                    aiMagicThumbnailImg.src = e.target.result;
                    aiMagicThumbnailContainer.style.display = 'flex';
                }

                // Show count if multiple
                if (fileList.length > 1) {
                    galleryCount.textContent = `${fileList.length} Images`;
                    galleryCount.style.display = 'block';
                } else {
                    galleryCount.style.display = 'none';
                }

                updateUIState();
            };
            reader.readAsDataURL(fileList[0]);

            // Gallery Preview
            gallery.innerHTML = '';
            if (fileList.length > 1) {
                gallery.style.display = 'grid';
                fileList.forEach(file => {
                    const r = new FileReader();
                    r.onload = (ev) => {
                        const item = document.createElement('div');
                        item.className = 'gallery-item';
                        item.innerHTML = `<img src="${ev.target.result}" alt="thumb">`;
                        gallery.appendChild(item);
                    };
                    r.readAsDataURL(file);
                });
            } else {
                gallery.style.display = 'none';
            }
        }

        // --- PREVIEW MODAL LOGIC ---
        const previewModal = document.getElementById('previewModal');
        const previewCloseBtn = document.getElementById('previewCloseBtn');
        const previewCancelBtn = document.getElementById('previewCancelBtn');
        const previewSaveBtn = document.getElementById('previewSaveBtn');
        const segInsta = document.getElementById('segInsta');
        const segLinkedin = document.getElementById('segLinkedin');
        const segThreads = document.getElementById('segThreads');
        const igCard = document.getElementById('igCard');
        const liCard = document.getElementById('liCard');
        const thCard = document.getElementById('thCard');
        const modalCaption = document.getElementById('modalCaption');
        const igCaptionRender = document.getElementById('igCaptionRender');
        const liCaptionRender = document.getElementById('liCaptionRender');
        const thCaptionRender = document.getElementById('thCaptionRender');
        const igPreviewImg = document.getElementById('igPreviewImg');
        const liPreviewImg = document.getElementById('liPreviewImg');
        const thPreviewImg = document.getElementById('thPreviewImg');
        const igPlaceholder = document.getElementById('igPlaceholder');
        const liPlaceholder = document.getElementById('liPlaceholder');
        const editorLabel = document.getElementById('editorLabel');
        const modalAccountSelect = document.getElementById('modalAccountSelect');
        const modalAccountSelectLabel = document.getElementById('modalAccountSelectLabel');

        let previewActivePlatform = 'instagram';
        let draftInsta = '';
        let draftLinkedin = '';
        let draftThreads = '';
        let draftLinkedinTarget = '';

        function escapeHtml(str) {
            return (str || '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#039;');
        }

        function renderHashtagsAsHtml(text) {
            const safe = escapeHtml(text || '');
            return safe.replace(/(^|\s)(#[\p{L}\d_]+)/gu, (m, p1, tag) => `${p1}<span class="hash">${tag}</span>`);
        }

        function updatePreviewImages() {
            const src = fileImg && fileImg.src ? fileImg.src : '';
            const hasSrc = !!src;

            if (hasSrc) {
                igPreviewImg.src = src;
                liPreviewImg.src = src;
                thPreviewImg.src = src;
                igPreviewImg.style.display = 'block';
                liPreviewImg.style.display = 'block';
                thPreviewImg.style.display = 'block';
                igPlaceholder.style.display = 'none';
                liPlaceholder.style.display = 'none';
            } else {
                igPreviewImg.style.display = 'none';
                liPreviewImg.style.display = 'none';
                thPreviewImg.style.display = 'none';
                igPlaceholder.style.display = 'block';
                liPlaceholder.style.display = 'block';
            }
        }

        function populateModalAccounts() {
            const isIg = previewActivePlatform === 'instagram';
            const isLi = previewActivePlatform === 'linkedin';
            const isTh = previewActivePlatform === 'threads';
            const accounts = isIg ? globalInstagramAccounts : (isLi ? globalLinkedInAccounts : globalThreadsAccounts);
            modalAccountSelect.innerHTML = '';
            if (!accounts || accounts.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = `— No ${isIg ? 'Instagram' : (isLi ? 'LinkedIn' : 'Threads')} accounts connected —`;
                modalAccountSelect.appendChild(opt);
                modalAccountSelectLabel.style.display = 'block';
                modalAccountSelect.style.display = 'block';
                return;
            }
            accounts.forEach((acc, idx) => {
                const opt = document.createElement('option');
                if (isIg) {
                    opt.value = acc.instagram_account_id || idx;
                    opt.textContent = '@' + acc.username;
                } else if (isLi) {
                    opt.value = acc.member_urn || idx;
                    opt.textContent = acc.name || 'LinkedIn Account';
                } else if (isTh) {
                    opt.value = acc.threads_account_id || idx;
                    opt.textContent = '@' + acc.username;
                }
                modalAccountSelect.appendChild(opt);
            });
            modalAccountSelectLabel.style.display = 'block';
            modalAccountSelect.style.display = 'block';
            updateModalPreviewCardHeader();
        }

        function updateModalPreviewCardHeader() {
            const isIg = previewActivePlatform === 'instagram';
            const isLi = previewActivePlatform === 'linkedin';
            const isTh = previewActivePlatform === 'threads';
            if (isIg) {
                const selectedVal = modalAccountSelect.value;
                const acc = globalInstagramAccounts.find(a => a.instagram_account_id === selectedVal) || globalInstagramAccounts[0];
                if (acc) {
                    document.getElementById('igUsername').textContent = '@' + acc.username;
                    const avatarEl = document.getElementById('igAvatar');
                    if (acc.profile_picture_url) {
                        avatarEl.innerHTML = `<img src="${acc.profile_picture_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">`;
                    } else {
                        avatarEl.textContent = (acc.username || 'U').charAt(0).toUpperCase();
                    }
                }
            } else if (isLi) {
                const selectedVal = modalAccountSelect.value;
                const acc = globalLinkedInAccounts.find(a => a.member_urn === selectedVal) || globalLinkedInAccounts[0];
                if (acc) {
                    document.getElementById('liName').textContent = acc.name || 'LinkedIn Member';
                    const liAvatarEl = document.getElementById('liAvatar');
                    if (acc.picture) {
                        liAvatarEl.innerHTML = `<img src="${acc.picture}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">`;
                    } else {
                        liAvatarEl.textContent = (acc.name || 'L').charAt(0).toUpperCase();
                    }
                }
            } else if (isTh) {
                const selectedVal = modalAccountSelect.value;
                const acc = globalThreadsAccounts.find(a => a.threads_account_id === selectedVal) || globalThreadsAccounts[0];
                if (acc) {
                    document.getElementById('thUsername').textContent = '@' + acc.username;
                    const avatarEl = document.getElementById('thAvatar');
                    avatarEl.textContent = (acc.username || 'T').charAt(0).toUpperCase();
                }
            }
        }

        function setPreviewPlatform(platform) {
            previewActivePlatform = platform;
            const isIg = platform === 'instagram';
            const isLi = platform === 'linkedin';
            const isTh = platform === 'threads';

            segInsta.setAttribute('aria-pressed', isIg ? 'true' : 'false');
            segLinkedin.setAttribute('aria-pressed', isLi ? 'true' : 'false');
            segThreads.setAttribute('aria-pressed', isTh ? 'true' : 'false');

            igCard.style.display = isIg ? 'block' : 'none';
            liCard.style.display = isLi ? 'block' : 'none';
            thCard.style.display = isTh ? 'block' : 'none';

            editorLabel.textContent = isIg ? 'Edit Instagram caption' : (isLi ? 'Edit LinkedIn caption' : 'Edit Threads post');

            modalCaption.value = isIg ? draftInsta : (isLi ? draftLinkedin : draftThreads);
            renderCaption();
            populateModalAccounts();
        }

        function renderCaption() {
            igCaptionRender.innerHTML = renderHashtagsAsHtml(draftInsta || '');
            liCaptionRender.textContent = draftLinkedin || '';
            thCaptionRender.innerHTML = renderHashtagsAsHtml(draftThreads || '');
        }

        function openPreviewModal() {
            draftInsta = document.getElementById('instaCaption').value || '';
            draftLinkedin = document.getElementById('linkedinCaption').value || '';
            draftThreads = document.getElementById('threadsCaption').value || '';
            
            updatePreviewImages();
            renderCaption();

            // Choose default platform based on selections
            const hasIg = document.getElementById('checkInsta').checked;
            const hasLi = document.getElementById('checkLinkedin').checked;
            const hasTh = document.getElementById('checkThreads').checked;
            if (!hasIg && !hasLi && hasTh) setPreviewPlatform('threads');
            else if (!hasIg && hasLi) setPreviewPlatform('linkedin');
            else setPreviewPlatform('instagram');

            previewModal.classList.add('open');
            document.body.style.overflow = 'hidden';
            modalCaption.focus();
        }

        function closePreviewModal() {
            previewModal.classList.remove('open');
            document.body.style.overflow = '';
        }

        previewBtn.onclick = () => {
            const hasFile = !!fileInput.files[0];
            const hasPlat = document.getElementById('checkInsta').checked || document.getElementById('checkLinkedin').checked || document.getElementById('checkThreads').checked;
            if (!hasFile || !hasPlat) {
                showToast('Upload media and select a platform first', 'warning');
                return;
            }
            openPreviewModal();
        };

        previewCloseBtn.onclick = closePreviewModal;
        previewCancelBtn.onclick = closePreviewModal;

        previewSaveBtn.onclick = () => {
            document.getElementById('instaCaption').value = draftInsta;
            document.getElementById('linkedinCaption').value = draftLinkedin;
            document.getElementById('threadsCaption').value = draftThreads;
            closePreviewModal();
            updateUIState();
            showToast('Preview saved', 'success');
        };

        segInsta.onclick = () => setPreviewPlatform('instagram');
        segLinkedin.onclick = () => setPreviewPlatform('linkedin');
        segThreads.onclick = () => setPreviewPlatform('threads');

        modalCaption.addEventListener('input', () => {
            if (previewActivePlatform === 'instagram') {
                draftInsta = modalCaption.value;
                document.getElementById('instaCaption').value = draftInsta;
            } else if (previewActivePlatform === 'linkedin') {
                draftLinkedin = modalCaption.value;
                document.getElementById('linkedinCaption').value = draftLinkedin;
            } else if (previewActivePlatform === 'threads') {
                draftThreads = modalCaption.value;
                document.getElementById('threadsCaption').value = draftThreads;
            }
            renderCaption();
        });

        modalAccountSelect.addEventListener('change', updateModalPreviewCardHeader);

        previewModal.addEventListener('click', (e) => {
            if (e.target === previewModal) closePreviewModal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && previewModal.classList.contains('open')) closePreviewModal();
        });

        // --- AI MAGIC ---
        const generateBtn = document.getElementById('generateBtn');
        // NOTE: generateBtn.onclick is set later in the AI Assistant section below (supports both image and prompt)

        // --- PUBLISHING ---
        const scheduleToggle = document.getElementById('scheduleToggle');
        const scheduleSection = document.getElementById('scheduleSection');
        let isScheduleActive = false;

        if (scheduleToggle) {
            scheduleToggle.onclick = () => {
                isScheduleActive = !isScheduleActive;
                if (scheduleSection) scheduleSection.style.display = isScheduleActive ? 'block' : 'none';
                scheduleToggle.classList.toggle('active', isScheduleActive);
                scheduleToggle.style.color = isScheduleActive ? 'var(--primary)' : '';
                updateUIState();
            };
        }

        const postBtn = document.getElementById('postBtn');
        postBtn.onclick = async () => {
            const targets = [];
            
            if (document.getElementById('checkInsta').checked) {
                const checkedBoxes = Array.from(document.querySelectorAll('input[name="instagramAccountsCheckbox"]:checked'));
                if (checkedBoxes.length === 0) return showToast('Choose at least one Instagram account', 'warning');
                checkedBoxes.forEach(box => {
                    targets.push({
                        platform: 'instagram',
                        id: box.value,
                        name: box.parentElement.querySelector('label').textContent
                    });
                });
            }
            
            if (document.getElementById('checkLinkedin').checked) {
                const checkedBoxes = Array.from(document.querySelectorAll('input[name="linkedinAccountsCheckbox"]:checked'));
                if (checkedBoxes.length === 0) return showToast('Choose at least one LinkedIn account', 'warning');
                checkedBoxes.forEach(box => {
                    targets.push({
                        platform: 'linkedin',
                        id: box.value,
                        name: box.parentElement.querySelector('label').textContent
                    });
                });
            }

            if (document.getElementById('checkThreads').checked) {
                const checkedBoxes = Array.from(document.querySelectorAll('input[name="threadsAccountsCheckbox"]:checked'));
                if (checkedBoxes.length === 0) return showToast('Choose at least one Threads account', 'warning');
                checkedBoxes.forEach(box => {
                    targets.push({
                        platform: 'threads',
                        id: box.value,
                        name: box.parentElement.querySelector('label').textContent
                    });
                });
            }

            if (targets.length === 0) return showToast('Select at least one platform and account', 'warning');

            const isScheduling = isScheduleActive && document.getElementById('scheduleTime').value;
            postBtn.disabled = true;
            postBtn.innerHTML = `<div class="loader"></div> <span>${isScheduling ? 'Scheduling' : 'Publishing'}...</span>`;

            try {
                // Timezone Fix: Convert local time to UTC ISO string
                let scheduledTime = document.getElementById('scheduleTime').value;
                if (isScheduling && scheduledTime) {
                    scheduledTime = new Date(scheduledTime).toISOString();
                }

                for (const target of targets) {
                    const fd = new FormData();
                    const files = Array.from(fileInput.files);
                    const isCarousel = files.length > 1;

                    if (isCarousel) {
                        files.forEach(f => fd.append('files', f));
                    } else if (files[0]) {
                        fd.append('file', files[0]);
                    }

                    if (isScheduling) {
                        fd.append('scheduled_at', scheduledTime);
                    }

                    let url = '';
                    if (target.platform === 'instagram') {
                        fd.append('text', document.getElementById('instaCaption').value);
                        fd.append('instagram_account_id', target.id);
                        fd.append('username', target.name.replace('@', ''));
                        if (isCarousel) {
                            url = isScheduling ? '/api/platforms/instagram/schedule-carousel' : '/api/platforms/instagram/post-carousel';
                        } else {
                            url = isScheduling ? '/api/platforms/instagram/schedule-post' : '/upload-post';
                        }
                    } else if (target.platform === 'linkedin') {
                        fd.append('text', document.getElementById('linkedinCaption').value);
                        fd.append('member_urn', target.id);
                        url = isScheduling ? '/api/platforms/linkedin/schedule-post' : '/api/platforms/linkedin/post';
                    } else if (target.platform === 'threads') {
                        fd.append('text', document.getElementById('threadsCaption').value);
                        fd.append('threads_account_id', target.id);
                        url = isScheduling ? '/api/platforms/threads/schedule-post' : '/api/platforms/threads/post';
                    }

                    if (!url) continue;
                    const resp = await fetchWithAuth(url, { method: 'POST', body: fd });
                    if (!resp || !resp.ok) {
                        const errMsg = await apiErrorMessage(resp, `Failed to post to ${target.platform} (${target.name})`);
                        throw new Error(errMsg);
                    }
                }
                showToast(isScheduling ? 'Missions set for future deployment!' : 'Broadcast successful!', 'success');
                await fetchScheduledJobs();
                await updateProfileDashboard();
                if (!isScheduling) {
                    resetPublisherForm();
                }
            } catch (e) {
                console.error("Publication Error:", e);
                showToast(e.message || 'Broadcast interrupted by error', 'error');
            } finally {
                postBtn.disabled = false;
                postBtn.innerHTML = '<i class="fas fa-paper-plane"></i> <span>Publish Post</span>';
            }
        };

        // --- UTILS ---
        function updateUIState() {
            const hasFile = !!fileInput.files[0];
            const checkInsta = document.getElementById('checkInsta').checked;
            const checkLinkedin = document.getElementById('checkLinkedin').checked;
            const checkThreads = document.getElementById('checkThreads').checked;
            const hasPlat = checkInsta || checkLinkedin || checkThreads;
            postBtn.disabled = !(hasFile && hasPlat);
            if (previewBtn) previewBtn.disabled = !(hasFile && hasPlat);

            document.getElementById('uiInstaTarget').style.display = checkInsta ? 'flex' : 'none';
            document.getElementById('uiLinkedinTarget').style.display = checkLinkedin ? 'flex' : 'none';
            document.getElementById('uiThreadsTarget').style.display = checkThreads ? 'flex' : 'none';
            
            // Keep hidden legacy caption containers in sync (they feed the postBtn logic)
            const instaCapContainer = document.getElementById('instaCaptionContainer');
            const linkedinCapContainer = document.getElementById('linkedinCaptionContainer');
            const threadsCapContainer = document.getElementById('threadsCaptionContainer');
            // NOTE: captionSection (unified composer) is always visible — do NOT hide it
            
            updateInpagePreview();
        }

        function updateInpagePreview() {
            const hasFile = !!fileInput.files[0];
            const checkInsta = document.getElementById('checkInsta').checked;
            const checkLinkedin = document.getElementById('checkLinkedin').checked;
            const checkThreads = document.getElementById('checkThreads').checked;
            
            const mockInsta = document.getElementById('mockInstagram');
            const mockLi = document.getElementById('mockLinkedin');
            const mockTh = document.getElementById('mockThreads');
            const previewBadge = document.getElementById('previewStatusBadge');

            if (checkInsta) mockInsta.style.display = 'block';
            else mockInsta.style.display = 'none';

            if (checkLinkedin) mockLi.style.display = 'block';
            else mockLi.style.display = 'none';

            if (mockTh) {
                if (checkThreads) mockTh.style.display = 'block';
                else mockTh.style.display = 'none';
            }

            const imgUrl = fileImg.src && hasFile ? fileImg.src : null;
            if (imgUrl) {
                document.getElementById('mockInstaImage').innerHTML = `<img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover;">`;
                document.getElementById('mockLinkedinImage').innerHTML = `<img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover;">`;
                const mockThImage = document.getElementById('mockThreadsImage');
                if (mockThImage) mockThImage.innerHTML = `<img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover; border-radius: 8px;">`;
            } else {
                document.getElementById('mockInstaImage').innerHTML = `<i class="fas fa-image" style="font-size: 2rem; opacity: 0.5;"></i>`;
                document.getElementById('mockLinkedinImage').innerHTML = `<i class="fas fa-image" style="font-size: 2rem; opacity: 0.5;"></i>`;
                const mockThImage = document.getElementById('mockThreadsImage');
                if (mockThImage) mockThImage.innerHTML = `<i class="fas fa-image" style="font-size: 2rem; opacity: 0.5; color: #666;"></i>`;
            }

            let instaCap = document.getElementById('instaCaption').value;
            let liCap = document.getElementById('linkedinCaption').value;
            let threadsCap = document.getElementById('threadsCaption') ? document.getElementById('threadsCaption').value : '';

            const formatCaption = (cap) => {
                if (!cap) return '<em style="color: var(--text-dim);">Waiting for AI caption...</em>';
                let formatted = cap.replace(/\n/g, '<br>');
                formatted = formatted.replace(/(#[a-zA-Z0-9_]+)/g, '<span style="color: #0095f6; cursor: pointer; font-weight: 500;">$1</span>');
                return formatted;
            };

            document.getElementById('mockInstaCaption').innerHTML = formatCaption(instaCap);
            document.getElementById('mockLinkedinCaption').innerHTML = formatCaption(liCap);
            const mockThreadsCapEl = document.getElementById('mockThreadsCaption');
            if (mockThreadsCapEl) mockThreadsCapEl.innerHTML = formatCaption(threadsCap);

            // Update mock Threads username from first connected account
            const mockThreadsUser = document.getElementById('mockThreadsUser');
            if (mockThreadsUser && globalThreadsAccounts.length > 0) {
                mockThreadsUser.textContent = '@' + globalThreadsAccounts[0].username;
            }

            if (hasFile && (checkInsta || checkLinkedin || checkThreads)) {
                if (previewBadge) previewBadge.style.display = 'flex';
            } else {
                if (previewBadge) previewBadge.style.display = 'none';
            }
            if (typeof updateSequentialPreview === 'function') {
                updateSequentialPreview();
            }
        }

        // Hook platform checkboxes
        ['checkInsta', 'checkLinkedin', 'checkThreads'].forEach(id => {
            document.getElementById(id).onchange = updateUIState;
        });

        function showToast(msg, type = 'success') {
            const t = document.getElementById('toast');
            const icon = document.getElementById('toastIcon');
            const m = document.getElementById('toastMsg');

            m.textContent = msg;
            icon.className = type === 'success' ? 'fas fa-check-circle' : (type === 'error' ? 'fas fa-times-circle' : 'fas fa-exclamation-circle');
            icon.style.color = `var(--${type})`;

            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 4000);
        }

        // --- SCHEDULER LIST ---
        async function fetchScheduledJobs() {
            try {
                const resp = await fetchWithAuth('/api/jobs');
                if (!resp) return;
                const jobs = await resp.json();
                globalJobs = jobs;
                const list = document.getElementById('jobsList');

                const scheduledJobs = jobs.filter(j => j.is_scheduled === 1);

                if (scheduledJobs.length === 0) {
                    list.innerHTML = `<div style="text-align: center; padding: 100px; color: var(--text-dim);">
                        <i class="fas fa-calendar-alt" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.2;"></i>
                        <p>No active missions in the queue</p>
                    </div>`;
                    return;
                }

                list.innerHTML = scheduledJobs.map(job => {
                    const showCancel = job.status === 'pending' ? 'block' : 'none';
                    return `
                        <div class="job-item">
                            ${buildJobThumbHtml(job)}
                            <div class="job-content">
                                <div class="job-header">
                                    <span class="job-platform">${job.platform}</span>
                                    <span class="job-status status-${job.status}">${job.status}</span>
                                </div>
                                <div class="job-time">${new Date(job.scheduled_at).toLocaleString()}</div>
                            </div>
                            <button class="btn-cancel" onclick="cancelMission('${job.job_id}')" style="background: none; border: none; color: var(--text-dim); cursor: pointer; transition: 0.3s; display: ${showCancel};"><i class="fas fa-times"></i></button>
                        </div>
                    `;
                }).join('');
            } catch (e) { }
        }

        async function cancelMission(jId) {
            if (!confirm('Abort this mission?')) return;
            try {
                const resp = await fetchWithAuth(`/api/jobs/${jId}`, { method: 'DELETE' });
                if (resp && resp.ok) {
                    showToast('Mission aborted', 'success');
                    fetchScheduledJobs();
                }
            } catch (e) { }
        }

        async function apiErrorMessage(resp, fallback = 'Sync Failed') {
            if (!resp) return 'Not authenticated';
            try {
                const err = await resp.json();
                if (err.detail) return typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
            } catch (_) { /* ignore */ }
            return fallback;
        }

        // Platform connection handlers with popup watcher
        function openAuthPopup(url, refreshFn) {
            const popup = window.open(url, '_blank', 'width=600,height=700');
            if (!popup) {
                showToast('Allow popups for this site, then try again.', 'error');
                return;
            }
            const timer = setInterval(() => {
                if (popup.closed) {
                    clearInterval(timer);
                    refreshFn();
                }
            }, 1000);
        }

        document.getElementById('addInstaAccount').onclick = async () => {
            const btn = document.getElementById('addInstaAccount');
            btn.disabled = true;
            try {
                const token = localStorage.getItem('access_token');
                if (!token) {
                    throw new Error('Not authenticated. Please login again.');
                }
                openAuthPopup(`/api/platforms/instagram/oauth?token=${encodeURIComponent(token)}`, () => {
                    fetchInstagramAccount();
                    updateProfileDashboard();
                    showToast('Refreshing Instagram accounts…', 'success');
                });
            } catch (e) {
                showToast(e.message || 'Connection error. Please try again.', 'error');
            } finally {
                btn.disabled = false;
            }
        };

        document.getElementById('refreshInstagram').onclick = fetchInstagramAccount;

        document.getElementById('addLinkedinAccount').onclick = async () => {
            const btn = document.getElementById('addLinkedinAccount');
            btn.disabled = true;
            try {
                const token = localStorage.getItem('access_token');
                if (!token) {
                    throw new Error('Not authenticated. Please login again.');
                }
                openAuthPopup(`/api/platforms/linkedin/connect?token=${encodeURIComponent(token)}&force=true`, () => {
                    fetchLinkedInAccounts();
                    updateProfileDashboard();
                    showToast('Checking LinkedIn connection...', 'success');
                });
            } catch (e) {
                showToast(e.message || 'Connection error. Please try again.', 'error');
            } finally {
                btn.disabled = false;
            }
        };

        document.getElementById('refreshLinkedIn').onclick = fetchLinkedInAccounts;
        document.getElementById('refreshThreads').onclick = fetchThreadsAccounts;
        document.getElementById('refreshJobs').onclick = fetchScheduledJobs;

        // --- THREADS ACCOUNT MANAGEMENT ---
        async function fetchThreadsAccounts() {
            try {
                const resp = await fetchWithAuth('/api/platforms/threads/accounts');
                if (!resp) return;
                const accounts = await resp.json();
                globalThreadsAccounts = accounts || [];

                const badge = document.getElementById('threadsBadge');
                const label = document.getElementById('threadsUserLabel');
                const listContainer = document.getElementById('threadsAccountsList');
                const select = document.getElementById('threadsAccounts');

                if (listContainer) listContainer.innerHTML = '';
                if (select) select.innerHTML = '';

                if (accounts && accounts.length > 0) {
                    if (badge) { badge.textContent = 'Active'; badge.className = 'job-status status-published'; }
                    if (label) label.textContent = `${accounts.length} Threads account(s) connected.`;

                    accounts.forEach(acc => {
                        // Checkbox in post form
                        if (select) {
                            const div = document.createElement('div');
                            div.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0;';
                            div.innerHTML = `
                                <input type="checkbox" name="threadsAccountsCheckbox" value="${acc.threads_account_id}" id="th_chk_${acc.threads_account_id}" style="cursor:pointer;accent-color:#000;">
                                <label for="th_chk_${acc.threads_account_id}" style="cursor:pointer;font-size:0.85rem;color:var(--text-main);">@${escapeHtml(acc.username)}</label>
                            `;
                            select.appendChild(div);
                        }
                        // Account list card with disconnect
                        if (listContainer) {
                            const item = document.createElement('div');
                            item.className = 'acc-item';
                            item.innerHTML = `
                                <i class="fas fa-check-circle"></i>
                                <span style="flex:1; color:var(--text-main);">@${escapeHtml(acc.username)}</span>
                                <button class="btn btn-ghost btn-sm btn-disconnect-threads" data-id="${acc.threads_account_id}" style="margin-left:8px; color:#ff5252;">Remove</button>
                            `;
                            listContainer.appendChild(item);
                        }
                    });

                    // Wire disconnect buttons
                    if (listContainer) {
                        listContainer.querySelectorAll('.btn-disconnect-threads').forEach(btn => {
                            btn.onclick = async (e) => {
                                e.stopPropagation();
                                const accountId = btn.getAttribute('data-id');
                                if (!confirm('Disconnect this Threads account?')) return;
                                try {
                                    const del = await fetchWithAuth(`/api/platforms/threads/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE' });
                                    if (del && del.ok) {
                                        showToast('Threads account disconnected.', 'success');
                                        fetchThreadsAccounts();
                                        updateProfileDashboard();
                                    } else {
                                        showToast('Failed to disconnect Threads account.', 'error');
                                    }
                                } catch (err) {
                                    showToast('Error disconnecting account.', 'error');
                                }
                            };
                        });
                    }
                } else {
                    if (badge) { badge.textContent = 'Disconnected'; badge.className = 'job-status status-failed'; }
                    if (label) label.textContent = 'Connect a Meta Threads account using direct credentials or environment token to publish thread posts and media assets.';
                    if (select) select.innerHTML = '<div style="color:var(--text-dim);font-size:0.8rem;padding:4px;">No accounts connected</div>';
                }
            } catch (e) {
                console.error('Threads accounts load failed:', e);
            }
        }

        document.getElementById('addThreadsAccount').onclick = async () => {
            // Show a credentials prompt modal
            const accId = prompt('Enter your Threads Account ID (numeric user ID from Meta):');
            if (!accId || !accId.trim()) return;
            const username = prompt('Enter your Threads username (without @):');
            if (!username || !username.trim()) return;
            const token = prompt('Enter your Threads Access Token:');
            if (!token || !token.trim()) return;

            try {
                const fd = new FormData();
                fd.append('threads_account_id', accId.trim());
                fd.append('username', username.trim());
                fd.append('access_token', token.trim());
                const resp = await fetchWithAuth('/api/platforms/threads/connect-direct', { method: 'POST', body: fd });
                if (resp && resp.ok) {
                    showToast('Threads account connected successfully!', 'success');
                    fetchThreadsAccounts();
                    updateProfileDashboard();
                } else {
                    const err = resp ? await resp.json().catch(() => ({})) : {};
                    showToast(err.detail || 'Failed to connect Threads account.', 'error');
                }
            } catch (e) {
                showToast('Error connecting Threads account.', 'error');
            }
        };

        const logoutModal = document.getElementById('logoutConfirmModal');
        document.getElementById('logoutBtn').onclick = () => {
            logoutModal.classList.add('open');
        };
        document.getElementById('logoutCancelBtn').onclick = () => {
            logoutModal.classList.remove('open');
        };
        logoutModal.onclick = (e) => {
            if (e.target === logoutModal) logoutModal.classList.remove('open');
        };
        document.getElementById('logoutConfirmBtn').onclick = () => {
            sessionStorage.setItem('pp_skip_auth_redirect', '1');
            localStorage.removeItem('access_token');
            window.location.href = '/static/login.html';
        };

        // --- DYNAMIC COMPOSER MODAL CONTROLLER & SYNC SYSTEM ---
        const composerModal = document.getElementById('composerModal');
        const openComposerModalBtn = document.getElementById('openComposerModalBtn');
        const composerCloseBtn = document.getElementById('composerCloseBtn');
        const modalSelectAllChannels = document.getElementById('modalSelectAllChannels');

        // Dynamic panel tab triggers (CHANGE 4 - 4 TABS CONTROLLERS)
        const modalTemplatesBtn = document.getElementById('modalTemplatesBtn');
        const modalAiMagicBtn = document.getElementById('modalAiMagicBtn');
        const modalAiAssistantBtn = document.getElementById('modalAiAssistantBtn');
        const modalPreviewToggleBtn = document.getElementById('modalPreviewToggleBtn');

        const panelPreviews = document.getElementById('panelPreviews');
        const panelAiAssistant = document.getElementById('panelAiAssistant');
        const panelTemplates = document.getElementById('panelTemplates');
        const panelAiMagic = document.getElementById('panelAiMagic');

        // Tab Switching logic
        function switchRightPanel(activePanel) {
            if (panelPreviews) panelPreviews.style.display = activePanel === 'preview' ? 'flex' : 'none';
            if (panelAiAssistant) panelAiAssistant.style.display = activePanel === 'ai' ? 'flex' : 'none';
            if (panelTemplates) panelTemplates.style.display = activePanel === 'templates' ? 'flex' : 'none';
            if (panelAiMagic) panelAiMagic.style.display = activePanel === 'aimagic' ? 'flex' : 'none';

            // Update tab button classes
            if (modalTemplatesBtn) modalTemplatesBtn.classList.toggle('active-tab', activePanel === 'templates');
            if (modalAiMagicBtn) modalAiMagicBtn.classList.toggle('active-tab', activePanel === 'aimagic');
            if (modalAiAssistantBtn) modalAiAssistantBtn.classList.toggle('active-tab', activePanel === 'ai');
            if (modalPreviewToggleBtn) modalPreviewToggleBtn.classList.toggle('active-tab', activePanel === 'preview');
        }

        if (modalTemplatesBtn) modalTemplatesBtn.onclick = () => switchRightPanel('templates');
        if (modalAiMagicBtn) modalAiMagicBtn.onclick = () => switchRightPanel('aimagic');
        if (modalAiAssistantBtn) modalAiAssistantBtn.onclick = () => switchRightPanel('ai');
        if (modalPreviewToggleBtn) modalPreviewToggleBtn.onclick = () => {
            switchRightPanel('preview');
            if (typeof updateSequentialPreview === 'function') updateSequentialPreview();
        };

        // Open/Close Modal & Platform pre-selection
        function openComposerWithPlatform(platform) {
            if (!composerModal) return;
            composerModal.classList.add('open');
            document.body.style.overflow = 'hidden';
            switchRightPanel('aimagic'); // DEFAULT TO AI MAGIC CAPTION TAB
            renderAvatarChips();
            renderTemplatesList();

            // Programmatically toggle selected platforms
            const checkInsta = document.getElementById('checkInsta');
            const checkLinkedin = document.getElementById('checkLinkedin');
            const checkThreads = document.getElementById('checkThreads');

            if (checkInsta) checkInsta.checked = (platform === 'instagram');
            if (checkLinkedin) checkLinkedin.checked = (platform === 'linkedin');
            if (checkThreads) checkThreads.checked = (platform === 'threads');

            // Select individual checkboxes if accounts are connected
            if (platform === 'instagram') {
                document.querySelectorAll('input[name="instagramAccountsCheckbox"]').forEach(chk => chk.checked = true);
                showToast("Drafting content for Instagram", "info");
            } else if (platform === 'linkedin') {
                document.querySelectorAll('input[name="linkedinAccountsCheckbox"]').forEach(chk => chk.checked = true);
                showToast("Drafting content for LinkedIn", "info");
            } else if (platform === 'threads') {
                document.querySelectorAll('input[name="threadsAccountsCheckbox"]').forEach(chk => chk.checked = true);
                showToast("Drafting content for Threads", "info");
            }

            updateUIState();
            if (typeof updateInpagePreview === 'function') updateInpagePreview();

            // Clear unified editor when opening
            const composerMainEditor = document.getElementById('composerMainEditor');
            if (composerMainEditor) {
                composerMainEditor.value = '';
                // aiGeneratedOutputText assignment removed to keep caption only in upper box
                composerMainEditor.dispatchEvent(new Event('input'));
            }
        }
        window.openComposerWithPlatform = openComposerWithPlatform;

        if (openComposerModalBtn) {
            openComposerModalBtn.onclick = () => {
                // Open with all platforms unselected by default or simple default
                openComposerWithPlatform('instagram');
            };
        }

        // Switchboard orbital nodes click events
        const nodeInsta = document.querySelector('.node-insta');
        if (nodeInsta) nodeInsta.onclick = () => openComposerWithPlatform('instagram');

        const nodeLinkedin = document.querySelector('.node-linkedin');
        if (nodeLinkedin) nodeLinkedin.onclick = () => openComposerWithPlatform('linkedin');

        const nodeThreads = document.querySelector('.node-threads');
        if (nodeThreads) nodeThreads.onclick = () => openComposerWithPlatform('threads');

        const nodeFacebook = document.querySelector('.node-facebook');
        if (nodeFacebook) nodeFacebook.onclick = () => showToast("Facebook integration coming in our upcoming release!", "info");

        const nodeTwitter = document.querySelector('.node-twitter');
        if (nodeTwitter) nodeTwitter.onclick = () => showToast("X (Twitter) integration coming in our upcoming release!", "info");

        const nodeTiktok = document.querySelector('.node-tiktok');
        if (nodeTiktok) nodeTiktok.onclick = () => showToast("TikTok integration coming in our upcoming release!", "info");

        const nodeYoutube = document.querySelector('.node-youtube');
        if (nodeYoutube) nodeYoutube.onclick = () => showToast("YouTube Shorts integration coming in our upcoming release!", "info");

        // Profile dashboard card redirection — use event delegation so it works after dynamic re-render
        document.querySelector('.profile-accounts-grid') && document.querySelector('.profile-accounts-grid').addEventListener('click', (e) => {
            const card = e.target.closest('.profile-account-card');
            if (card) {
                switchTab('accounts');
                showToast("Connect your profiles under the My Accounts tab!", "info");
            }
        });

        function closeComposerModal() {
            composerModal.classList.remove('open');
            document.body.style.overflow = '';
        }

        if (composerCloseBtn) {
            composerCloseBtn.onclick = closeComposerModal;
        }

        // Click overlay backdrop to close
        composerModal.addEventListener('click', (e) => {
            if (e.target === composerModal) closeComposerModal();
        });

        // Escape key closes composer modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && composerModal.classList.contains('open')) closeComposerModal();
        });

        // --- PHOTO PREVIEW SYNC SYSTEM (Change 2) ---
        const composerMediaPreviewArea = document.getElementById('composerMediaPreviewArea');
        const composerImagePreviewImg = document.getElementById('composerImagePreviewImg');
        const composerRemovePreviewBtnModal = document.getElementById('composerRemovePreviewBtn');

        if (composerRemovePreviewBtnModal) {
            composerRemovePreviewBtnModal.onclick = () => {
                const removeMediaBtn = document.getElementById('removeMediaBtn');
                if (removeMediaBtn) removeMediaBtn.click();
            };
        }

        // --- CUSTOM CALENDAR DATE & TIME PICKER SYSTEM (Change 6) ---
        let calSelectedDate = null;
        let calCurrentMonth = new Date().getMonth();
        let calCurrentYear = new Date().getFullYear();

        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        function renderCustomCalendar() {
            const monthYearEl = document.getElementById('calMonthYear');
            const datesGrid = document.getElementById('calDatesGrid');
            if (!monthYearEl || !datesGrid) return;

            monthYearEl.textContent = `${monthNames[calCurrentMonth]} ${calCurrentYear}`;
            datesGrid.innerHTML = '';

            const firstDayIndex = new Date(calCurrentYear, calCurrentMonth, 1).getDay();
            const startDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // Mon=0, Sun=6
            const totalDays = new Date(calCurrentYear, calCurrentMonth + 1, 0).getDate();

            for (let i = 0; i < startDay; i++) {
                const empty = document.createElement('div');
                datesGrid.appendChild(empty);
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (let day = 1; day <= totalDays; day++) {
                const dateBtn = document.createElement('button');
                dateBtn.type = 'button';
                dateBtn.textContent = day;
                dateBtn.style.cssText = `
                    background: transparent; border: none; padding: 6px; border-radius: 50%;
                    font-size: 0.78rem; font-weight: 600; cursor: pointer; width: 28px; height: 28px;
                    display: grid; place-items: center; margin: 0 auto; color: var(--text-main);
                    transition: 0.2s;
                `;

                const cellDate = new Date(calCurrentYear, calCurrentMonth, day);
                cellDate.setHours(0, 0, 0, 0);

                if (cellDate < today) {
                    dateBtn.style.opacity = '0.3';
                    dateBtn.style.pointerEvents = 'none';
                }

                if (cellDate.getTime() === today.getTime()) {
                    dateBtn.style.border = '2px solid var(--accent)';
                }

                if (calSelectedDate && cellDate.getTime() === calSelectedDate.getTime()) {
                    dateBtn.style.background = 'var(--accent)';
                    dateBtn.style.color = '#FFFFFF';
                    dateBtn.style.border = 'none';
                }

                dateBtn.onclick = () => {
                    calSelectedDate = cellDate;
                    renderCustomCalendar();
                    validateScheduleBtn();
                };

                datesGrid.appendChild(dateBtn);
            }
        }

        function validateScheduleBtn() {
            const confirmBtn = document.getElementById('btnConfirmSchedule');
            if (confirmBtn) {
                confirmBtn.disabled = !calSelectedDate;
                confirmBtn.style.opacity = calSelectedDate ? '1' : '0.5';
            }
        }

        const calPrevMonth = document.getElementById('calPrevMonth');
        const calNextMonth = document.getElementById('calNextMonth');

        if (calPrevMonth) {
            calPrevMonth.onclick = () => {
                const today = new Date();
                if (calCurrentYear > today.getFullYear() || (calCurrentYear === today.getFullYear() && calCurrentMonth > today.getMonth())) {
                    calCurrentMonth--;
                    if (calCurrentMonth < 0) {
                        calCurrentMonth = 11;
                        calCurrentYear--;
                    }
                    renderCustomCalendar();
                }
            };
        }

        if (calNextMonth) {
            calNextMonth.onclick = () => {
                calCurrentMonth++;
                if (calCurrentMonth > 11) {
                    calCurrentMonth = 0;
                    calCurrentYear++;
                }
                renderCustomCalendar();
            };
        }

        const btnConfirmSchedule = document.getElementById('btnConfirmSchedule');
        if (btnConfirmSchedule) {
            btnConfirmSchedule.onclick = () => {
                if (!calSelectedDate) return;

                const hour = document.getElementById('calHour').value;
                const min = document.getElementById('calMinute').value;
                const period = document.getElementById('calPeriod').value;

                let hr24 = parseInt(hour);
                if (period === 'PM' && hr24 !== 12) hr24 += 12;
                if (period === 'AM' && hr24 === 12) hr24 = 0;

                const timeStr = `${String(hr24).padStart(2, '0')}:${min}`;
                const yyyy = calSelectedDate.getFullYear();
                const mm = String(calSelectedDate.getMonth() + 1).padStart(2, '0');
                const dd = String(calSelectedDate.getDate()).padStart(2, '0');

                const formattedLocalIso = `${yyyy}-${mm}-${dd}T${timeStr}`;

                const hiddenTimeInput = document.getElementById('scheduleTime');
                if (hiddenTimeInput) {
                    hiddenTimeInput.value = formattedLocalIso;
                    hiddenTimeInput.dispatchEvent(new Event('change'));
                }

                const schedOverlay = document.getElementById('schedulePopupOverlay');
                if (schedOverlay) schedOverlay.classList.remove('open');

                const dateStr = calSelectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                showToast(`✅ Post scheduled for ${dateStr} at ${hour}:${min} ${period}`, 'success');
            };
        }

        const btnCancelSchedule = document.getElementById('btnCancelSchedule');
        if (btnCancelSchedule) {
            btnCancelSchedule.onclick = () => {
                const schedOverlay = document.getElementById('schedulePopupOverlay');
                if (schedOverlay) schedOverlay.classList.remove('open');
                
                const hiddenTimeInput = document.getElementById('scheduleTime');
                if (!hiddenTimeInput || !hiddenTimeInput.value) {
                    setComposerPublishMode('now');
                }
            };
        }

        // Set local timezone defaults
        const calTimezone = document.getElementById('calTimezone');
        if (calTimezone) {
            const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
            let exists = false;
            for (let i = 0; i < calTimezone.options.length; i++) {
                if (calTimezone.options[i].value === localTz) {
                    calTimezone.options[i].selected = true;
                    exists = true;
                    break;
                }
            }
            if (!exists) {
                const opt = document.createElement('option');
                opt.value = localTz;
                opt.textContent = `${localTz} (Local)`;
                opt.selected = true;
                calTimezone.appendChild(opt);
            }
        }

        // --- SEQUENTIAL PLATFORM PREVIEW NAVIGATION SYSTEM (Change 5) ---
        let currentPreviewPlatIndex = 0;

        function updateSequentialPreview() {
            let selectedPlats = [];
            if (document.getElementById('checkInsta').checked) selectedPlats.push('instagram');
            if (document.getElementById('checkLinkedin').checked) selectedPlats.push('linkedin');
            if (document.getElementById('checkThreads').checked) selectedPlats.push('threads');

            const tabInsta = document.getElementById('modalPreviewTabInsta');
            const tabLinkedin = document.getElementById('modalPreviewTabLinkedin');
            const tabThreads = document.getElementById('modalPreviewTabThreads');
            const emptyPlaceholder = document.getElementById('previewEmptyPlaceholder');
            const seqNav = document.getElementById('previewSequentialNav');

            // Hide/Show Preview Tabs
            if (tabInsta) tabInsta.style.display = document.getElementById('checkInsta').checked ? 'inline-block' : 'none';
            if (tabLinkedin) tabLinkedin.style.display = document.getElementById('checkLinkedin').checked ? 'inline-block' : 'none';
            if (tabThreads) tabThreads.style.display = document.getElementById('checkThreads').checked ? 'inline-block' : 'none';

            const mockInstagram = document.getElementById('mockInstagram');
            const mockLinkedin = document.getElementById('mockLinkedin');
            const mockThreads = document.getElementById('mockThreads');

            if (mockInstagram) mockInstagram.style.display = 'none';
            if (mockLinkedin) mockLinkedin.style.display = 'none';
            if (mockThreads) mockThreads.style.display = 'none';

            if (selectedPlats.length === 0) {
                if (emptyPlaceholder) emptyPlaceholder.style.display = 'flex';
                if (seqNav) seqNav.style.display = 'none';
                return;
            } else {
                if (emptyPlaceholder) emptyPlaceholder.style.display = 'none';
                if (seqNav) seqNav.style.display = 'flex';
            }

            if (currentPreviewPlatIndex >= selectedPlats.length) {
                currentPreviewPlatIndex = 0;
            }

            const activePlat = selectedPlats[currentPreviewPlatIndex];

            // Sync Tab active styling
            if (tabInsta) tabInsta.classList.toggle('active', activePlat === 'instagram');
            if (tabLinkedin) tabLinkedin.classList.toggle('active', activePlat === 'linkedin');
            if (tabThreads) tabThreads.classList.toggle('active', activePlat === 'threads');

            const activeCard = document.getElementById(
                activePlat === 'instagram' ? 'mockInstagram' : activePlat === 'linkedin' ? 'mockLinkedin' : 'mockThreads'
            );

            if (activeCard) {
                activeCard.style.display = 'block';
                activeCard.style.opacity = '0';
                activeCard.style.transform = 'translateX(20px)';
                activeCard.style.transition = 'none';
                setTimeout(() => {
                    activeCard.style.transition = 'opacity 250ms ease, transform 250ms ease';
                    activeCard.style.opacity = '1';
                    activeCard.style.transform = 'translateX(0)';
                }, 30);
            }

            // Update Progress text
            const progressIndicator = document.getElementById('previewProgressIndicator');
            if (progressIndicator) {
                progressIndicator.textContent = `${currentPreviewPlatIndex + 1} of ${selectedPlats.length}`;
            }

            // Update Button
            const nextBtn = document.getElementById('previewNextBtn');
            if (nextBtn) {
                if (currentPreviewPlatIndex === selectedPlats.length - 1) {
                    nextBtn.innerHTML = `<span>✅ Looks Good! Go Back</span>`;
                } else {
                    const nextPlatRaw = selectedPlats[currentPreviewPlatIndex + 1];
                    const nextPlatName = nextPlatRaw.charAt(0).toUpperCase() + nextPlatRaw.slice(1);
                    nextBtn.innerHTML = `<span>Next: ${nextPlatName} Preview</span> <i class="fas fa-arrow-right"></i>`;
                }
            }
        }

        const previewNextBtn = document.getElementById('previewNextBtn');
        if (previewNextBtn) {
            previewNextBtn.onclick = () => {
                let selectedPlats = [];
                if (document.getElementById('checkInsta').checked) selectedPlats.push('instagram');
                if (document.getElementById('checkLinkedin').checked) selectedPlats.push('linkedin');
                if (document.getElementById('checkThreads').checked) selectedPlats.push('threads');

                if (selectedPlats.length === 0) return;

                if (currentPreviewPlatIndex === selectedPlats.length - 1) {
                    // Loop back or return to composition panel
                    currentPreviewPlatIndex = 0;
                    switchRightPanel('aimagic');
                    showToast('Returned to Magic Composer!', 'info');
                } else {
                    currentPreviewPlatIndex++;
                }
                updateSequentialPreview();
            };
        }

        // --- AI MAGIC CAPTION GENERATOR CONTROLLER (Change 4) ---
        const aiMagicGenerateBtn = document.getElementById('aiMagicGenerateBtn');
        const aiMagicPromptInput = document.getElementById('aiMagicPromptInput');
        const aiMagicToneSelect = document.getElementById('aiMagicToneSelect');
        const aiMagicLoader = document.getElementById('aiMagicLoader');
        const aiMagicOutputContainer = document.getElementById('aiMagicOutputContainer');
        const aiMagicOutputText = document.getElementById('aiMagicOutputText');
        const aiMagicCopyBtn = document.getElementById('aiMagicCopyBtn');
        const aiMagicUseBtn = document.getElementById('aiMagicUseBtn');
        const aiMagicThumbnailContainer = document.getElementById('aiMagicThumbnailContainer');
        const aiMagicThumbnailImg = document.getElementById('aiMagicThumbnailImg');

        // --- OPENAI API KEY RESOLVER ---
        function getOpenAIKey() {
            // Check localStorage first (set via: localStorage.setItem('OPENAI_API_KEY', 'sk-...'))
            const lsKey = localStorage.getItem('OPENAI_API_KEY');
            if (lsKey && lsKey.startsWith('sk-')) return lsKey;
            return null;
        }

        // --- FILE TO BASE64 HELPER ---
        function getFileBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        // --- OPENAI FETCH WRAPPER ---
        async function callOpenAI(messages, apiKey) {
            const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: messages,
                    max_tokens: 600,
                    temperature: 0.8
                })
            });
            if (resp.status === 401) throw new Error('OPENAI_401');
            if (resp.status === 429) throw new Error('OPENAI_429');
            if (!resp.ok) throw new Error('OPENAI_' + resp.status);
            const data = await resp.json();
            return data.choices[0].message.content.trim();
        }

        if (aiMagicGenerateBtn) {
            aiMagicGenerateBtn.onclick = async () => {
                const promptText = aiMagicPromptInput ? aiMagicPromptInput.value.trim() : '';
                const hasFile = fileInput && fileInput.files && fileInput.files[0];
                const tone = aiMagicToneSelect ? aiMagicToneSelect.value : 'casual';

                if (!promptText && !hasFile) {
                    return showToast('Please enter context or upload an image to generate a caption.', 'warning');
                }

                aiMagicGenerateBtn.style.display = 'none';
                if (aiMagicLoader) aiMagicLoader.style.display = 'block';
                if (aiMagicOutputContainer) aiMagicOutputContainer.style.display = 'none';

                try {
                    let generatedText = '';
                    const apiKey = getOpenAIKey();

                    if (apiKey) {
                        // === OPENAI PATH ===
                        let messages = [];
                        const systemMsg = { role: 'system', content: `You are a social media expert. Write engaging, platform-optimized captions in a ${tone} tone. Include relevant emojis and 3-5 hashtags. Keep it concise and compelling.` };

                        if (hasFile) {
                            // Method B: Image-based caption using OpenAI Vision
                            const b64 = await getFileBase64(fileInput.files[0]);
                            const userContent = [
                                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'low' } },
                                { type: 'text', text: promptText ? `Write a ${tone} social media caption for this image. Context: ${promptText}` : `Write a compelling ${tone} social media caption for this image. Include relevant hashtags.` }
                            ];
                            messages = [systemMsg, { role: 'user', content: userContent }];
                        } else {
                            // Method A: Text prompt-based caption
                            messages = [systemMsg, { role: 'user', content: `Write a ${tone} social media caption about: "${promptText}". Make it engaging with emojis and 3-5 relevant hashtags.` }];
                        }
                        generatedText = await callOpenAI(messages, apiKey);
                    } else {
                        // === BACKEND / FALLBACK PATH ===
                        if (hasFile) {
                            // Use backend /api/ai/analyze-image
                            const fd = new FormData();
                            fd.append('file', fileInput.files[0]);
                            if (promptText) fd.append('topic', promptText);
                            if (tone) fd.append('tone', tone);

                            const resp = await fetchWithAuth('/api/ai/analyze-image', { method: 'POST', body: fd });
                            if (resp && resp.ok) {
                                const data = await resp.json();
                                // Backend returns: instagram, linkedin, threads (multi-caption) or full_caption, caption (single)
                                generatedText = data.instagram || data.full_caption || data.caption || '';
                                if (!generatedText && data.linkedin) generatedText = data.linkedin;
                                
                                // Sync back to specific captions if needed
                                const ic = document.getElementById('instaCaption');
                                const lc = document.getElementById('linkedinCaption');
                                const tc = document.getElementById('threadsCaption');
                                if (data.instagram && ic) ic.value = data.instagram;
                                if (data.linkedin && lc) lc.value = data.linkedin;
                                if (data.threads && tc) tc.value = data.threads;
                            } else {
                                throw new Error('AI image analysis failed');
                            }
                        } else {
                            // Use backend /generate-caption (or /api/ai/generate-caption)
                            const fd = new FormData();
                            fd.append('prompt', promptText);
                            fd.append('platform', 'instagram');
                            if (tone) fd.append('tone', tone);

                            const resp = await fetchWithAuth('/generate-caption', { method: 'POST', body: fd });
                            if (resp && resp.ok) {
                                const data = await resp.json();
                                generatedText = data.full_caption || data.caption || '';
                            } else {
                                // Fallback to local template if backend fails or is offline
                                if (tone === 'formal') {
                                    generatedText = `Dear Professionals,\n\nWe are pleased to share: "${promptText}". 👔\n\nThis represents a significant milestone in our ongoing efforts to deliver high-quality solutions.\n\nSincerely, Post Pilot\n\n#Professional #Innovation`;
                                } else {
                                    generatedText = `🚀 ${promptText}\n\nThis is a moment worth sharing! Whether you're just getting started or leveling up, every step forward counts. Drop a comment below! 💬\n\n#ContentCreator #PostPilotAI #SocialMedia`;
                                }
                                showToast('Using local template fallback.', 'warning');
                            }
                        }
                    }

                    if (generatedText) {
                        if (aiMagicOutputText) aiMagicOutputText.textContent = generatedText;
                        if (aiMagicOutputContainer) aiMagicOutputContainer.style.display = 'flex';
                    }
                } catch (err) {
                    console.error('AI Magic Generation Error:', err);
                    if (err.message === 'OPENAI_401') showToast('Invalid OpenAI API key. Check your key in localStorage.', 'error');
                    else if (err.message === 'OPENAI_429') showToast('OpenAI rate limit reached. Please wait a moment.', 'error');
                    else showToast('Caption generation failed: ' + err.message, 'error');
                } finally {
                    if (aiMagicLoader) aiMagicLoader.style.display = 'none';
                    aiMagicGenerateBtn.style.display = 'block';
                }
            };
        }

        if (aiMagicCopyBtn) {
            aiMagicCopyBtn.onclick = () => {
                if (aiMagicOutputText) {
                    navigator.clipboard.writeText(aiMagicOutputText.textContent);
                    showToast('Copied to clipboard!', 'success');
                }
            };
        }

        if (aiMagicUseBtn) {
            aiMagicUseBtn.onclick = () => {
                if (aiMagicOutputText && composerMainEditor) {
                    composerMainEditor.value = aiMagicOutputText.textContent;
                    composerMainEditor.dispatchEvent(new Event('input'));
                    showToast('Caption loaded into editor!', 'success');
                    switchRightPanel('preview'); // Switch to preview tab to see it!
                }
            };
        }

        // Render 9-channel visual avatar chips (CHANGE 3 - OFFICIAL SVGs, SIZE 48px, LOCK DELETED)
        function renderAvatarChips() {
            const container = document.querySelector('.avatar-selectors-row');
            if (!container) return;
            container.innerHTML = '';

            // Connected Instagram Accounts
            if (globalInstagramAccounts && globalInstagramAccounts.length > 0) {
                globalInstagramAccounts.forEach(acc => {
                    const chk = document.querySelector(`input[name="instagramAccountsCheckbox"][value="${acc.instagram_account_id}"]`);
                    const activeClass = chk && chk.checked ? 'active' : '';
                    const chip = document.createElement('div');
                    chip.className = `avatar-chip ${activeClass}`;
                    chip.title = `@${acc.username} (Instagram)`;
                    
                    const avatarContent = acc.profile_picture_url 
                        ? `<img src="${acc.profile_picture_url}" alt="ig">`
                        : `<i class="fas fa-user fallback-icon"></i>`;
                        
                    chip.innerHTML = `
                        ${avatarContent}
                        <div class="platform-badge" style="background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285aeb 90%); display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; padding: 2px;">
                            <svg viewBox="0 0 24 24" style="width: 100%; height: 100%;" fill="white">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a3.838 3.838 0 110-7.676 3.838 3.838 0 010 7.676zm4.965-10.405a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                            </svg>
                        </div>
                    `;
                    chip.onclick = () => {
                        const targetCheckbox = document.getElementById('checkInsta');
                        if (targetCheckbox) targetCheckbox.checked = true; // Make sure platform is checked
                        
                        if (chk) {
                            chk.checked = !chk.checked;
                            chk.dispatchEvent(new Event('change'));
                        }
                        chip.classList.toggle('active', chk ? chk.checked : false);
                        updateUIState();
                        if (typeof updateInpagePreview === 'function') updateInpagePreview();
                    };
                    container.appendChild(chip);
                });
            } else {
                // Connect Instagram placeholder (Premium Brand SVG)
                const chip = document.createElement('div');
                chip.className = 'avatar-chip locked';
                chip.title = 'Connect Instagram (Business/Creator)';
                chip.innerHTML = `
                    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                        <svg viewBox="0 0 48 48" style="width: 100%; height: 100%; border-radius: 50%;">
                            <defs>
                                <radialGradient id="ig-radial" cx="30%" cy="107%" r="130%">
                                    <stop offset="0%" stop-color="#fdf497" />
                                    <stop offset="5%" stop-color="#fdf497" />
                                    <stop offset="45%" stop-color="#fd5949" />
                                    <stop offset="60%" stop-color="#d6249f" />
                                    <stop offset="90%" stop-color="#285AEB" />
                                </radialGradient>
                            </defs>
                            <rect width="48" height="48" fill="url(#ig-radial)"/>
                            <path d="M24 14.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM24 12c-3.259 0-3.668.014-4.948.072-4.358.2-6.78 2.618-6.98 6.98-.058 1.281-.072 1.689-.072 4.948 0 3.259.014 3.668.072 4.948.2 4.354 2.618 6.782 6.98 6.979 1.28.059 1.689.073 4.948.073 3.259 0 3.667-.014 4.947-.072 4.354-.196 6.78-2.617 6.98-6.979.058-1.28.072-1.689.072-4.948 0-3.259-.014-3.668-.072-4.948-.2-4.354-2.618-6.78-6.98-6.979C27.668 12.014 27.259 12 24 12zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a3.838 3.838 0 110-7.676 3.838 3.838 0 010 7.676zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" fill="#fff" transform="scale(0.7) translate(5.1, 5.1)"/>
                        </svg>
                    </div>
                    <div class="lock-overlay"><i class="fas fa-plus"></i></div>
                `;
                chip.onclick = () => showToast('Connect an Instagram account under the My Accounts tab.', 'warning');
                container.appendChild(chip);
            }

            // Connected LinkedIn Accounts
            if (globalLinkedInAccounts && globalLinkedInAccounts.length > 0) {
                globalLinkedInAccounts.forEach(acc => {
                    const chk = document.querySelector(`input[name="linkedinAccountsCheckbox"][value="${acc.member_urn}"]`);
                    const activeClass = chk && chk.checked ? 'active' : '';
                    const chip = document.createElement('div');
                    chip.className = `avatar-chip ${activeClass}`;
                    chip.title = `${acc.name} (LinkedIn)`;
                    
                    const avatarContent = acc.picture 
                        ? `<img src="${acc.picture}" alt="li">`
                        : `<i class="fas fa-user fallback-icon"></i>`;
                        
                    chip.innerHTML = `
                        ${avatarContent}
                        <div class="platform-badge" style="background: #0077b5; display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 4px; padding: 2px;">
                            <svg viewBox="0 0 24 24" style="width: 100%; height: 100%;" fill="white">
                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                            </svg>
                        </div>
                    `;
                    chip.onclick = () => {
                        const targetCheckbox = document.getElementById('checkLinkedin');
                        if (targetCheckbox) targetCheckbox.checked = true;
                        
                        if (chk) {
                            chk.checked = !chk.checked;
                            chk.dispatchEvent(new Event('change'));
                        }
                        chip.classList.toggle('active', chk ? chk.checked : false);
                        updateUIState();
                        if (typeof updateInpagePreview === 'function') updateInpagePreview();
                    };
                    container.appendChild(chip);
                });
            } else {
                // Connect LinkedIn placeholder (Premium Brand SVG)
                const chip = document.createElement('div');
                chip.className = 'avatar-chip locked';
                chip.title = 'Connect LinkedIn Profile';
                chip.innerHTML = `
                    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                        <svg viewBox="0 0 48 48" style="width: 100%; height: 100%; border-radius: 50%;">
                            <rect width="48" height="48" fill="#0077B5"/>
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 18.5H6V10h3v8.5zM7.5 8.7c-.9 0-1.7-.8-1.7-1.7s.8-1.7 1.7-1.7 1.7.8 1.7 1.7-.8 1.7-1.7 1.7zm11 9.8h-3v-4.8c0-1.1-.9-2-2-2s-2 .9-2 2v4.8h-3V10h3v1.3c.6-.8 1.6-1.3 2.7-1.3 1.8 0 3.3 1.5 3.3 3.3v5.2z" fill="#fff" transform="scale(0.8) translate(4.8, 4.8)"/>
                        </svg>
                    </div>
                    <div class="lock-overlay"><i class="fas fa-plus"></i></div>
                `;
                chip.onclick = () => showToast('Connect a LinkedIn Profile under the My Accounts tab.', 'warning');
                container.appendChild(chip);
            }

            // Connected Threads Accounts
            if (globalThreadsAccounts && globalThreadsAccounts.length > 0) {
                globalThreadsAccounts.forEach(acc => {
                    const chk = document.querySelector(`input[name="threadsAccountsCheckbox"][value="${acc.threads_account_id}"]`);
                    const activeClass = chk && chk.checked ? 'active' : '';
                    const chip = document.createElement('div');
                    chip.className = `avatar-chip ${activeClass}`;
                    chip.title = `@${acc.username} (Threads)`;
                    
                    chip.innerHTML = `
                        <i class="fas fa-user fallback-icon"></i>
                        <div class="platform-badge" style="background: #000000; display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; padding: 2px;">
                            <svg viewBox="0 0 192 192" style="width: 100%; height: 100%;" fill="white">
                                <path d="M128.6 97.2c-.7-3.9-2.1-7.3-4.3-10.2-2.9-3.8-7-6.5-12.2-7.9-1.8-.5-3.7-.8-5.7-.9-3.6-.2-6.9.3-9.9 1.4-4.5 1.7-8 4.9-10.1 9.2-1.4 2.9-2.1 6.1-2.1 9.5 0 3.9.9 7.5 2.7 10.6 2.4 4.2 6.1 7.2 11 8.8 3.1 1 6.5 1.3 10.1 1 2.5-.2 4.8-.7 7-1.6v6.3c-2.1.7-4.5 1.1-7.1 1.3-4.8.3-9.5-.2-13.8-1.7-6.8-2.3-12.1-6.6-15.4-12.5-2.5-4.4-3.8-9.4-3.8-14.9 0-5 1.1-9.7 3.2-13.8 3-5.8 7.8-10.3 14.1-12.9 4.3-1.7 9-2.5 14.1-2.2 2.8.2 5.5.6 8 1.4 8.2 2.3 14.5 7.3 18.1 14.5 1.9 3.8 3 8 3.2 12.6.1 2.1.1 3.9-.1 5.6-.5 7.2-3.1 12.8-7.6 16.6-4.2 3.5-9.6 5.2-15.9 5.1-3.3-.1-6.3-.7-8.9-2-2.2-1.1-4-2.7-5.2-4.8-.7 1.4-1.6 2.6-2.7 3.6-2.3 2.1-5.3 3.2-8.7 3.2-4.2 0-7.7-1.5-10.2-4.4-2.3-2.6-3.5-6.2-3.5-10.5 0-4.1 1.2-7.8 3.5-10.5 2.5-2.9 6-4.5 10.2-4.5 2.3 0 4.4.5 6.1 1.5v-1.3h6.5v20.8c0 1.9.4 3.4 1.3 4.4.9 1.1 2.2 1.6 3.9 1.7 4.4.1 8.2-1.2 11-3.8 3.1-2.9 4.8-7.2 5.2-12.7.1-1.5.2-3.1.1-4.9zm-37.7 12.1c1.3 1.6 3.1 2.4 5.3 2.4 2.2 0 4-.8 5.3-2.4 1.3-1.5 2-3.7 2-6.2 0-2.6-.7-4.7-2-6.2-1.3-1.5-3.1-2.3-5.3-2.3-2.2 0-4 .8-5.3 2.3-1.3 1.5-2 3.6-2 6.2 0 2.5.7 4.7 2 6.2z"/>
                            </svg>
                        </div>
                    `;
                    chip.onclick = () => {
                        const targetCheckbox = document.getElementById('checkThreads');
                        if (targetCheckbox) targetCheckbox.checked = true;
                        
                        if (chk) {
                            chk.checked = !chk.checked;
                            chk.dispatchEvent(new Event('change'));
                        }
                        chip.classList.toggle('active', chk ? chk.checked : false);
                        updateUIState();
                        if (typeof updateInpagePreview === 'function') updateInpagePreview();
                    };
                    container.appendChild(chip);
                });
            } else {
                // Connect Threads placeholder (Premium Brand SVG)
                const chip = document.createElement('div');
                chip.className = 'avatar-chip locked';
                chip.title = 'Connect Threads Account';
                chip.innerHTML = `
                    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                        <svg viewBox="0 0 48 48" style="width: 100%; height: 100%; border-radius: 50%;">
                            <rect width="48" height="48" fill="#000000"/>
                            <path d="M27.25 21.46c-.75-.43-1.63-.66-2.58-.66-2.45 0-4.14 1.63-4.14 4.09 0 2.3 1.64 4.04 4.01 4.04 1.05 0 2-.31 2.75-.89V21.46zm5.83 5.43c0 3.73-2.6 6.84-6.66 6.84-2.64 0-4.83-1.28-5.83-3.15-.07.03-.13.06-.2.09-2.07.82-4.12.87-5.59-.2-1.39-1.01-2.01-2.73-2.01-4.71 0-4.27 3.32-8.31 9.47-8.31 1.07 0 2.16.14 3.12.42.06-.22.14-.44.25-.66 1.04-2.12 3.16-3.23 5.76-3.23 3.65 0 6.13 2.18 6.13 6.01 0 5.47-3.78 8.16-7.85 8.16-1.57 0-2.82-.57-3.32-1.46-.22-.38-.34-.84-.34-1.38V21.6c-.66-.46-1.46-.73-2.34-.73-3.17 0-5.32 2.37-5.32 5.56 0 3.12 2.06 5.44 5.11 5.44 1.25 0 2.37-.41 3.25-1.12v.22c0 .94.22 1.67.62 2.16.54.67 1.39 1 2.45 1 2.94 0 4.67-2.18 4.67-5.8v-.25c0-2.38-1.42-3.75-3.69-3.75-1.5 0-2.68.75-3.24 2.13l-.06.16h.06zm-7.79-11.39c-4.49 0-6.9 2.9-6.9 6.06 0 1.34.42 2.48 1.35 3.14.98.7 2.43.68 3.84.12a14.28 14.28 0 002.58-1.27c-.45-3.08-1.55-5.91-3.2-8.05h.33zm11.75 3.33c0-2.45-1.38-3.78-3.56-3.78-1.42 0-2.58.64-3.12 1.76-.08.17-.14.34-.18.52 1.83 2.07 2.99 4.79 3.42 7.79 2.04-.37 3.44-2.29 3.44-6.29z" fill="#fff" transform="scale(0.8) translate(4.8, 4.8)"/>
                        </svg>
                    </div>
                    <div class="lock-overlay"><i class="fas fa-plus"></i></div>
                `;
                chip.onclick = () => showToast('Connect a Threads account under the My Accounts tab.', 'warning');
                container.appendChild(chip);
            }
        }

        // Handle Select All Channels checkbox inside modal
        if (modalSelectAllChannels) {
            modalSelectAllChannels.onchange = () => {
                const active = modalSelectAllChannels.checked;
                
                const checkInsta = document.getElementById('checkInsta');
                const checkLinkedin = document.getElementById('checkLinkedin');
                const checkThreads = document.getElementById('checkThreads');

                if (checkInsta) checkInsta.checked = active;
                if (checkLinkedin) checkLinkedin.checked = active;
                if (checkThreads) checkThreads.checked = active;

                // Check all individual account boxes
                document.querySelectorAll('input[name="instagramAccountsCheckbox"]').forEach(chk => chk.checked = active);
                document.querySelectorAll('input[name="linkedinAccountsCheckbox"]').forEach(chk => chk.checked = active);
                document.querySelectorAll('input[name="threadsAccountsCheckbox"]').forEach(chk => chk.checked = active);

                // Re-render visual chips & update UI preview state
                renderAvatarChips();
                updateUIState();
                if (typeof updateInpagePreview === 'function') updateInpagePreview();
            };
        }

        // Unified Editor and text syncing logic
        const composerMainEditor = document.getElementById('composerMainEditor');
        const instaCaption = document.getElementById('instaCaption');
        const linkedinCaption = document.getElementById('linkedinCaption');
        const threadsCaption = document.getElementById('threadsCaption');

        if (composerMainEditor) {
            composerMainEditor.addEventListener('input', () => {
                const val = composerMainEditor.value;
                if (instaCaption) instaCaption.value = val;
                if (linkedinCaption) linkedinCaption.value = val;
                if (threadsCaption) threadsCaption.value = val;

                // Dispatch event so previews update in real-time
                if (instaCaption) instaCaption.dispatchEvent(new Event('input'));
                if (linkedinCaption) linkedinCaption.dispatchEvent(new Event('input'));
                if (threadsCaption) threadsCaption.dispatchEvent(new Event('input'));
            });
        }

        // Emojis & Hashtags quick inject inside composer
        const composerEmojiBtn = document.getElementById('composerEmojiBtn');
        if (composerEmojiBtn) {
            composerEmojiBtn.onclick = () => {
                if (composerMainEditor) {
                    composerMainEditor.value += " ✨🚀🔥";
                    composerMainEditor.dispatchEvent(new Event('input'));
                }
            };
        }
        const composerHashtagBtn = document.getElementById('composerHashtagBtn');
        if (composerHashtagBtn) {
            composerHashtagBtn.onclick = () => {
                if (composerMainEditor) {
                    composerMainEditor.value += " #SocialMedia #PostPilotAI";
                    composerMainEditor.dispatchEvent(new Event('input'));
                }
            };
        }

        // Templates list implementation
        const prebuiltCaptionTemplates = [
            { category: "Launch", title: "🚀 Product Launch", body: "BIG NEWS! 🚀 We are officially launching [Product Name] today! This has been months in the making and we can't wait for you to experience it. Use code START at checkout! #NewLaunch #Innovation #ProductRelease" },
            { category: "Promo", title: "🎁 Limited Promotion", body: "ALERT! 🚨 For a very limited time, enjoy 20% OFF on all collections! perfect time to grab your favorites or try something new. Use code code at checkout. Hurry, sale ends soon! #FlashSale #Discount #ShopNow" },
            { category: "Tips", title: "💡 Expert Tip", body: "Here is a quick tip to instantly improve your daily output: [Insert specific tip]. 💡 Focus on consistency rather than intensity. Drop a double-tap if you found this helpful! #ExpertTips #LifeHacks #Knowledge" },
            { category: "Quote", title: "✨ Inspiration Quote", body: "Every expert was once a beginner. The secret to getting ahead is simply getting started. ✨ What is one goal you are chasing this week? Let us know below! #Motivation #SuccessMindset #DailyDrive" },
            { category: "Hiring", title: "💼 We Are Hiring!", body: "We're expanding our team! 💼 Looking for a passionate [Role Name] to join us in building the future of social automation. Link in bio to apply. Know someone perfect? Tag them below! #Hiring #Careers #JobOpening" },
            { category: "Promo", title: "🎉 Seasonal Celebration", body: "Wishing our amazing community a beautiful season! 🎉 To celebrate, we are hosting an exclusive giveaway. Swipe left to see how you can win premium packages! #Celebration #Giveaway #CommunityLove" }
        ];

        function renderTemplatesList() {
            const grid = document.getElementById('templatesListGrid');
            if (!grid) return;
            grid.innerHTML = '';
            prebuiltCaptionTemplates.forEach(t => {
                const card = document.createElement('div');
                card.className = 'template-card-item';
                card.style.padding = '12px';
                card.style.border = '1px solid var(--border)';
                card.style.borderRadius = '10px';
                card.style.cursor = 'pointer';
                card.style.background = 'var(--surface-lighter)';
                card.onclick = () => {
                    // composerMainEditor assignment removed to keep caption only in upper box
                    switchRightPanel('preview'); // Switch to live preview when template is applied
                    showToast('Template applied!', 'success');
                };
                card.innerHTML = `
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                        <span style="font-weight:700;font-size:0.75rem;color:var(--accent);text-transform:uppercase;">${t.category}</span>
                        <span style="font-size:0.8rem;font-weight:600;color:var(--text-main);">${t.title}</span>
                    </div>
                    <p style="font-size:0.78rem;color:var(--text-dim);line-height:1.4;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${t.body}</p>
                `;
                grid.appendChild(card);
            });
        }

        const templateSearchInput = document.getElementById('templateSearchInput');
        if (templateSearchInput) {
            templateSearchInput.onkeyup = () => {
                const query = templateSearchInput.value.toLowerCase();
                const cards = document.getElementById('templatesListGrid').querySelectorAll('.template-card-item');
                cards.forEach((card, idx) => {
                    const t = prebuiltCaptionTemplates[idx];
                    const match = t.title.toLowerCase().includes(query) || t.body.toLowerCase().includes(query) || t.category.toLowerCase().includes(query);
                    card.style.display = match ? 'block' : 'none';
                });
            };
        }

        // AI Assistant Slides Controller
        const aiSlideWelcome = document.getElementById('aiSlideWelcome');
        const aiSlidePrompt = document.getElementById('aiSlidePrompt');
        const aiSlideRefine = document.getElementById('aiSlideRefine');
        const btnAiWelcomeNext = document.getElementById('btnAiWelcomeNext');
        const btnAiGenerate = document.getElementById('generateBtn');
        const aiPromptInput = document.getElementById('aiPromptInput');
        const aiGeneratedOutputText = document.getElementById('aiGeneratedOutputText');

        if (btnAiWelcomeNext) {
            btnAiWelcomeNext.onclick = () => {
                if (aiSlideWelcome) aiSlideWelcome.style.display = 'none';
                if (aiSlidePrompt) aiSlidePrompt.style.display = 'block';
            };
        }

        // Refine tone controls
        function adjustTone(tone) {
            if (!composerMainEditor) return;
            let val = composerMainEditor.value;
            if (!val) return showToast('Please write or generate text first.', 'warning');

            if (tone === 'formal') {
                val = "Dear Professionals,\n\n" + val.replace(/Dear Professionals,|Hey guys! 🙌|✨|🚀|🔥/g, '').trim() + "\n\nSincerely,\nPost Pilot";
            } else if (tone === 'casual') {
                val = "Hey guys! 🙌 " + val.replace(/Dear Professionals,|Sincerely,\nPost Pilot/g, '').trim() + " Let me know your thoughts in the comments below! 👇✨";
            } else if (tone === 'emojis') {
                val = "✨ " + val + " 🚀🔥📈";
            } else if (tone === 'hashtags') {
                val = val + " #PostPilot #Innovation #SaaS #ContentMarketing";
            } else if (tone === 'retry') {
                if (aiSlideRefine) aiSlideRefine.style.display = 'none';
                if (aiSlidePrompt) aiSlidePrompt.style.display = 'block';
                return;
            }

            composerMainEditor.value = val;
            composerMainEditor.dispatchEvent(new Event('input'));
            if (aiGeneratedOutputText) aiGeneratedOutputText.textContent = val;
            showToast(`Tone adjusted to ${tone.toUpperCase()}`, 'success');
        }

        const btnToneFormal = document.getElementById('btnToneFormal');
        if (btnToneFormal) btnToneFormal.onclick = () => adjustTone('formal');
        
        const btnToneCasual = document.getElementById('btnToneCasual');
        if (btnToneCasual) btnToneCasual.onclick = () => adjustTone('casual');
        
        const btnToneEmojis = document.getElementById('btnToneEmojis');
        if (btnToneEmojis) btnToneEmojis.onclick = () => adjustTone('emojis');
        
        const btnToneHashtags = document.getElementById('btnToneHashtags');
        if (btnToneHashtags) btnToneHashtags.onclick = () => adjustTone('hashtags');
        
        const btnToneRetry = document.getElementById('btnToneRetry');
        if (btnToneRetry) btnToneRetry.onclick = () => adjustTone('retry');

        // Scheduler Footer Integration
        const composerPublishNowBtn = document.getElementById('composerPublishNowBtn');
        const composerScheduleLaterBtn = document.getElementById('composerScheduleLaterBtn');
        // scheduleSection already declared
        const scheduleTime = document.getElementById('scheduleTime');

        function setComposerPublishMode(mode) {
            if (composerPublishNowBtn) composerPublishNowBtn.classList.toggle('active', mode === 'now');
            if (composerScheduleLaterBtn) composerScheduleLaterBtn.classList.toggle('active', mode === 'schedule');
            
            const schedOverlay = document.getElementById('schedulePopupOverlay');
            if (mode === 'now') {
                if (composerPublishNowBtn) {
                    composerPublishNowBtn.style.background = 'var(--surface-dark)';
                    composerPublishNowBtn.style.color = 'var(--accent)';
                }
                if (composerScheduleLaterBtn) {
                    composerScheduleLaterBtn.style.background = 'transparent';
                    composerScheduleLaterBtn.style.color = 'var(--text-dim)';
                }
                if (schedOverlay) schedOverlay.classList.remove('open');
                
                // turn off schedule active
                if (isScheduleActive) {
                    const schedToggle = document.getElementById('scheduleToggle');
                    if (schedToggle) schedToggle.click();
                }
            } else {
                if (composerPublishNowBtn) {
                    composerPublishNowBtn.style.background = 'transparent';
                    composerPublishNowBtn.style.color = 'var(--text-dim)';
                }
                if (composerScheduleLaterBtn) {
                    composerScheduleLaterBtn.style.background = 'var(--surface-dark)';
                    composerScheduleLaterBtn.style.color = 'var(--accent)';
                }
                if (schedOverlay) schedOverlay.classList.add('open');
                if (typeof renderCustomCalendar === 'function') renderCustomCalendar();
                
                // turn on schedule active
                if (!isScheduleActive) {
                    const schedToggle = document.getElementById('scheduleToggle');
                    if (schedToggle) schedToggle.click();
                }
                
                if (scheduleTime && !scheduleTime.value) {
                    const future = new Date(Date.now() + 2 * 60 * 60 * 1000);
                    const localIso = new Date(future.getTime() - future.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                    scheduleTime.value = localIso;
                }
            }
        }

        if (composerPublishNowBtn) composerPublishNowBtn.onclick = () => setComposerPublishMode('now');
        if (composerScheduleLaterBtn) composerScheduleLaterBtn.onclick = () => setComposerPublishMode('schedule');

        // Preview mock tabs switches inside modal
        const modalPreviewTabInsta = document.getElementById('modalPreviewTabInsta');
        const modalPreviewTabLinkedin = document.getElementById('modalPreviewTabLinkedin');
        const modalPreviewTabThreads = document.getElementById('modalPreviewTabThreads');

        const mockInstagram = document.getElementById('mockInstagram');
        const mockLinkedin = document.getElementById('mockLinkedin');
        const mockThreads = document.getElementById('mockThreads');

        function switchPreviewMockPlatform(plat) {
            let selectedPlats = [];
            if (document.getElementById('checkInsta').checked) selectedPlats.push('instagram');
            if (document.getElementById('checkLinkedin').checked) selectedPlats.push('linkedin');
            if (document.getElementById('checkThreads').checked) selectedPlats.push('threads');

            const idx = selectedPlats.indexOf(plat);
            if (idx !== -1) {
                currentPreviewPlatIndex = idx;
                updateSequentialPreview();
            }
        }

        if (modalPreviewTabInsta) modalPreviewTabInsta.onclick = () => switchPreviewMockPlatform('instagram');
        if (modalPreviewTabLinkedin) modalPreviewTabLinkedin.onclick = () => switchPreviewMockPlatform('linkedin');
        if (modalPreviewTabThreads) modalPreviewTabThreads.onclick = () => switchPreviewMockPlatform('threads');

        // AI Assistant: Generate Caption from text prompt (wired to OpenAI with fallback)
        generateBtn.onclick = async () => {
            const promptText = aiPromptInput ? aiPromptInput.value.trim() : '';
            const hasFile = fileInput && fileInput.files && fileInput.files[0];
            
            if (!promptText && !hasFile) {
                return showToast('Please enter a prompt or upload an image to generate a caption.', 'warning');
            }
            
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<div class="loader"></div> <span>Generating...</span>';
            
            try {
                let generatedText = '';
                const apiKey = getOpenAIKey();

                if (apiKey) {
                    // === OPENAI PATH ===
                    let messages = [];
                    const systemMsg = { role: 'system', content: 'You are a social media expert. Write engaging, high-converting social media captions with relevant emojis and 4-6 hashtags. Be creative and platform-agnostic.' };

                    if (hasFile) {
                        const b64 = await getFileBase64(fileInput.files[0]);
                        messages = [systemMsg, {
                            role: 'user',
                            content: [
                                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'low' } },
                                { type: 'text', text: promptText ? `Write a social media caption for this image. Context: ${promptText}` : 'Write an engaging social media caption for this image.' }
                            ]
                        }];
                    } else {
                        messages = [systemMsg, { role: 'user', content: `Write an engaging social media caption about: "${promptText}". Include emojis and 4-6 relevant hashtags.` }];
                    }

                    generatedText = await callOpenAI(messages, apiKey);

                    // Also update hidden captions
                    const ic = document.getElementById('instaCaption');
                    const lc = document.getElementById('linkedinCaption');
                    const tc = document.getElementById('threadsCaption');
                    if (ic) ic.value = generatedText;
                    if (lc) lc.value = generatedText;
                    if (tc) tc.value = generatedText;

                } else {
                    // === FALLBACK ===
                    if (hasFile) {
                        const fd = new FormData();
                        fd.append('file', fileInput.files[0]);
                        const resp = await fetchWithAuth('/api/ai/analyze-image', { method: 'POST', body: fd });
                        if (resp && resp.ok) {
                            const data = await resp.json();
                            generatedText = data.instagram || data.linkedin || data.threads || '';
                            const ic = document.getElementById('instaCaption');
                            const lc = document.getElementById('linkedinCaption');
                            const tc = document.getElementById('threadsCaption');
                            if (data.instagram && ic) ic.value = data.instagram;
                            if (data.linkedin && lc) lc.value = data.linkedin;
                            if (data.threads && tc) tc.value = data.threads;
                        } else {
                            throw new Error('AI image analysis failed');
                        }
                    } else {
                        generatedText = `🚀 ${promptText}\n\nThis is a moment worth sharing! Whether you're just getting started or leveling up, every step forward counts. Drop a comment below! 💬\n\n#ContentCreator #PostPilotAI #SocialMedia #Engagement #Growth`;
                        showToast('Tip: Set your OpenAI key: localStorage.setItem("OPENAI_API_KEY","sk-...")', 'warning');
                    }
                }
                
                if (generatedText) {
                    if (composerMainEditor) {
                        composerMainEditor.value = generatedText;
                        composerMainEditor.dispatchEvent(new Event('input'));
                    }
                    // Also show in refine preview if present
                    if (aiGeneratedOutputText) aiGeneratedOutputText.textContent = generatedText;
                    if (aiSlidePrompt) aiSlidePrompt.style.display = 'none';
                    if (aiSlideRefine) aiSlideRefine.style.display = 'flex';
                    showToast('Caption generated! Refine it below.', 'success');
                }
            } catch (err) {
                console.error('AI Generation Error:', err);
                if (err.message === 'OPENAI_401') showToast('Invalid OpenAI API key. Check localStorage.', 'error');
                else if (err.message === 'OPENAI_429') showToast('OpenAI rate limit reached. Please wait.', 'error');
                else showToast('Caption generation failed. Try again.', 'error');
            } finally {
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> <span>Generate Caption</span>';
            }
        };

        // Auto-close composer modal after a successful publish
        const _origPostBtnHandler = postBtn.onclick;
        if (_origPostBtnHandler) {
            postBtn.onclick = async function() {
                await _origPostBtnHandler.call(this);
                // If post succeeded (no error toast shown), close the modal
                setTimeout(() => {
                    if (composerModal && composerModal.classList.contains('open')) {
                        const toastEl = document.getElementById('toast');
                        const isError = toastEl && toastEl.classList.contains('error');
                        if (!isError) {
                            composerModal.classList.remove('open');
                            document.body.style.overflow = '';
                        }
                    }
                }, 1200);
            };
        }

        init();
    