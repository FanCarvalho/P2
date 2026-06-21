document.addEventListener('DOMContentLoaded', async () => {
    if (typeof ensureAuthenticated === 'function') {
        const ok = await ensureAuthenticated();
        if (!ok) return;
    }

    const currentUser = typeof getAuthenticatedUser === 'function' ? getAuthenticatedUser() : null;
    const profileForm = document.getElementById('profile-form');
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const emailInput = document.getElementById('email');
    const accessLevelInput = document.getElementById('accessLevel');
    const phoneInput = document.getElementById('phone');
    const bioInput = document.getElementById('bio');
    const profileName = document.querySelector('.profile-meta h2');
    const profileEmail = document.querySelector('.profile-meta .page-subtitle');
    const profileRole = document.getElementById('profileRole');
    const profileAvatar = document.querySelector('.profile-head .avatar');
    const profileCancelBtn = document.getElementById('profileCancelBtn');
    const tabButtons = Array.from(document.querySelectorAll('.settings-tab[data-tab-target]'));
    const tabPanels = Array.from(document.querySelectorAll('.settings-panel'));
    const feedbackEl = document.getElementById('settingsFeedback');

    const securityForm = document.getElementById('security-form');
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    let initialProfileState = null;

    function showFeedback(message, type = '') {
        if (!feedbackEl) return;
        feedbackEl.textContent = message || '';
        feedbackEl.classList.remove('is-success', 'is-error');
        if (type === 'success') feedbackEl.classList.add('is-success');
        if (type === 'error') feedbackEl.classList.add('is-error');
    }

    function activateTab(panelId) {
        tabButtons.forEach(button => {
            const isActive = button.dataset.tabTarget === panelId;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        tabPanels.forEach(panel => {
            panel.hidden = panel.id !== panelId;
        });
    }

    function bindTabSwitching() {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                activateTab(button.dataset.tabTarget);
                showFeedback('');
            });
        });
    }

    function splitName(fullName) {
        const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
        return {
            firstName: parts[0] || '',
            lastName: parts.slice(1).join(' ')
        };
    }

    function formatAccessLevel(level) {
        if (!level) return 'Utilizador';
        return String(level).charAt(0).toUpperCase() + String(level).slice(1);
    }

    function updateProfileHeader(name, email, level) {
        profileName.textContent = name || 'Conta autenticada';
        profileEmail.textContent = email || 'Sem email associado';
        profileRole.textContent = formatAccessLevel(level);

        if (profileAvatar) {
            const initials = String(name || 'U')
                .split(' ')
                .filter(Boolean)
                .map(part => part[0])
                .join('')
                .toUpperCase() || 'U';
            profileAvatar.textContent = initials;
        }
    }

    function buildDisplayName(firstName, lastName, fallbackName = 'Utilizador') {
        const full = `${String(firstName || '').trim()} ${String(lastName || '').trim()}`.trim();
        return full || fallbackName;
    }

    function syncTopbarAvatarWithProfile(name, email, level) {
        if (typeof updateSessionUser === 'function') {
            updateSessionUser(
                {
                    id_operador: currentUser?.id_operador,
                    name,
                    email,
                    nivel_acesso: level
                },
                email
            );
        }

        if (typeof updateTopbarAvatar === 'function') {
            updateTopbarAvatar();
        }
    }

    if (currentUser) {
        const nameParts = splitName(currentUser.name);
        firstNameInput.value = nameParts.firstName;
        lastNameInput.value = nameParts.lastName;
        emailInput.value = currentUser.email || '';
        accessLevelInput.value = formatAccessLevel(currentUser.nivel_acesso);
        bioInput.value = `Conta ${String(currentUser.nivel_acesso || 'utilizador').toLowerCase()} da Glowpath.`;
        updateProfileHeader(currentUser.name, currentUser.email, currentUser.nivel_acesso);
    }

    function snapshotProfileState() {
        return {
            firstName: firstNameInput.value,
            lastName: lastNameInput.value,
            email: emailInput.value,
            phone: phoneInput.value,
            bio: bioInput.value
        };
    }

    function applyProfileState(state) {
        if (!state) return;
        firstNameInput.value = state.firstName || '';
        lastNameInput.value = state.lastName || '';
        emailInput.value = state.email || '';
        phoneInput.value = state.phone || '';
        bioInput.value = state.bio || '';
    }

    // Função para carregar os dados do utilizador
    async function loadUserData() {
        try {
            const response = await authFetch('/api/user');
            if (!response.ok) {
                throw new Error('Erro ao carregar os dados do utilizador');
            }
            const user = await response.json();

            firstNameInput.value = user.firstName || '';
            lastNameInput.value = user.lastName || '';
            emailInput.value = user.email || '';
            accessLevelInput.value = formatAccessLevel(currentUser?.nivel_acesso || user.nivel_acesso || '');
            phoneInput.value = user.phone || '';
            bioInput.value = user.bio || `Conta ${String(currentUser?.nivel_acesso || 'utilizador').toLowerCase()} da Glowpath.`;
            const displayName = buildDisplayName(user.firstName, user.lastName, currentUser?.name || 'Utilizador');
            const displayEmail = user.email || currentUser?.email || '';
            const displayLevel = currentUser?.nivel_acesso || user.nivel_acesso || '';

            updateProfileHeader(displayName, displayEmail, displayLevel);
            syncTopbarAvatarWithProfile(displayName, displayEmail, displayLevel);
            initialProfileState = snapshotProfileState();

        } catch (error) {
            console.error('Error loading user data:', error);
            initialProfileState = snapshotProfileState();
        }
    }

    // Função para guardar as alterações
    profileForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const updatedUser = {
            firstName: firstNameInput.value,
            lastName: lastNameInput.value,
            email: emailInput.value,
            phone: phoneInput.value,
            bio: bioInput.value,
        };

        try {
            const response = await authFetch('/api/user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedUser),
            });

            if (!response.ok) {
                throw new Error('Erro ao guardar os dados do utilizador');
            }

            const result = await response.json();
            showFeedback(result.message || 'Alterações guardadas com sucesso!', 'success');
            
            // Atualizar o cabeçalho do perfil
            const displayName = buildDisplayName(updatedUser.firstName, updatedUser.lastName, currentUser?.name || 'Utilizador');
            const displayEmail = updatedUser.email || currentUser?.email || '';
            const displayLevel = currentUser?.nivel_acesso || accessLevelInput.value || '';

            updateProfileHeader(displayName, displayEmail, displayLevel);
            syncTopbarAvatarWithProfile(displayName, displayEmail, displayLevel);
            initialProfileState = snapshotProfileState();

        } catch (error) {
            console.error('Error saving user data:', error);
            showFeedback('Erro ao guardar as alterações. Por favor, tente novamente.', 'error');
        }
    });

    if (profileCancelBtn) {
        profileCancelBtn.addEventListener('click', () => {
            applyProfileState(initialProfileState);
            showFeedback('Alterações do perfil revertidas.', 'success');
        });
    }

    if (securityForm) {
        securityForm.addEventListener('submit', async event => {
            event.preventDefault();

            const currentPwd = currentPasswordInput.value;
            const newPwd = newPasswordInput.value;
            const confirmPwd = confirmPasswordInput.value;

            if (!currentPwd || !newPwd || !confirmPwd) {
                showFeedback('Por favor, preencha todos os campos da palavra-passe.', 'error');
                return;
            }

            if (newPwd.length < 8) {
                showFeedback('A nova palavra-passe deve ter pelo menos 8 caracteres.', 'error');
                return;
            }

            if (newPwd !== confirmPwd) {
                showFeedback('A nova palavra-passe e a confirmação não coincidem.', 'error');
                return;
            }

            try {
                const response = await authFetch('/api/user/password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        currentPassword: currentPwd,
                        newPassword: newPwd,
                        confirmPassword: confirmPwd
                    })
                });

                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    const msg = payload?.errors?.currentPassword?.[0]
                        || payload?.errors?.newPassword?.[0]
                        || payload?.errors?.confirmPassword?.[0]
                        || payload?.description
                        || 'Erro ao atualizar a palavra-passe.';
                    showFeedback(msg, 'error');
                    return;
                }

                currentPasswordInput.value = '';
                newPasswordInput.value = '';
                confirmPasswordInput.value = '';
                showFeedback('Palavra-passe atualizada com sucesso.', 'success');
            } catch (error) {
                console.error('Error updating password:', error);
                showFeedback('Erro ao atualizar a palavra-passe. Por favor, tente novamente.', 'error');
            }
        });
    }

    bindTabSwitching();
    activateTab('profile-panel');

    // Carregar os dados do utilizador quando a página é carregada
    loadUserData();
});
