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

    if (currentUser) {
        const nameParts = splitName(currentUser.name);
        firstNameInput.value = nameParts.firstName;
        lastNameInput.value = nameParts.lastName;
        emailInput.value = currentUser.email || '';
        accessLevelInput.value = formatAccessLevel(currentUser.nivel_acesso);
        bioInput.value = `Conta ${String(currentUser.nivel_acesso || 'utilizador').toLowerCase()} da Glowpath.`;
        updateProfileHeader(currentUser.name, currentUser.email, currentUser.nivel_acesso);
    }

    // Função para carregar os dados do utilizador
    async function loadUserData() {
        try {
            const response = await authFetch('/api/user');
            if (!response.ok) {
                throw new Error('Failed to load user data');
            }
            const user = await response.json();

            firstNameInput.value = user.firstName || '';
            lastNameInput.value = user.lastName || '';
            emailInput.value = user.email || '';
            accessLevelInput.value = formatAccessLevel(currentUser?.nivel_acesso || user.nivel_acesso || '');
            phoneInput.value = user.phone || '';
            bioInput.value = user.bio || `Conta ${String(currentUser?.nivel_acesso || 'utilizador').toLowerCase()} da Glowpath.`;
            updateProfileHeader(`${user.firstName || ''} ${user.lastName || ''}`.trim() || currentUser?.name, user.email || currentUser?.email, currentUser?.nivel_acesso || user.nivel_acesso);

        } catch (error) {
            console.error('Error loading user data:', error);
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
                throw new Error('Failed to save user data');
            }

            const result = await response.json();
            alert(result.message || 'Changes saved successfully!');
            
            // Atualizar o cabeçalho do perfil
            updateProfileHeader(`${updatedUser.firstName} ${updatedUser.lastName}`.trim(), updatedUser.email, currentUser?.nivel_acesso || accessLevelInput.value);

        } catch (error) {
            console.error('Error saving user data:', error);
            alert('Error saving changes. Please try again.');
        }
    });

    // Carregar os dados do utilizador quando a página é carregada
    loadUserData();
});
