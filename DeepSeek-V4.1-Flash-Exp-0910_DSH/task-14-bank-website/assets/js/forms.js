/* ==========================================================================
   Meridian Bank — form validation
   Progressive, dependency-free validation for the site's forms (report fraud,
   contact, and the application wizard). Errors are rendered next to the field,
   announced politely, and the first invalid control is focused on submit.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var ERR_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/></svg>';

  function errorNode(field) {
    var key = field.id || field.name;
    var scope = field.form || doc;
    var holder = field.closest('.field') || field.parentNode;
    // Prefer an explicitly placed message (works for radio grids and checkbox
    // rows, where the error belongs to the group rather than one control).
    var node = scope.querySelector('.err[data-err-for="' + key + '"]') || holder.querySelector('.err');
    if (!node) {
      node = doc.createElement('p');
      node.className = 'err';
      node.hidden = true;
      holder.appendChild(node);
    }
    node.setAttribute('data-err-for', key || '');
    return node;
  }

  function showError(field, message) {
    var node = errorNode(field);
    node.innerHTML = ERR_ICON + '<span>' + message + '</span>';
    node.hidden = false;
    field.classList.add('is-bad');
    field.setAttribute('aria-invalid', 'true');
    var described = field.getAttribute('aria-describedby') || '';
    var id = 'err-' + (field.id || field.name);
    node.id = id;
    if (described.indexOf(id) === -1) {
      field.setAttribute('aria-describedby', (described + ' ' + id).trim());
    }
  }

  function clearError(field) {
    var holder = field.closest('.field') || field.parentNode;
    var node = holder.querySelector('.err[data-err-for="' + (field.id || field.name) + '"]') || holder.querySelector('.err');
    if (node) node.hidden = true;
    field.classList.remove('is-bad');
    field.removeAttribute('aria-invalid');
  }

  var EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  /** Returns an error string, or '' when the field is acceptable. */
  function validateField(field) {
    var label = field.getAttribute('data-label') ||
      (field.labels && field.labels[0] ? field.labels[0].textContent.replace('*', '').trim() : 'This field');

    // Radio groups: `required` means "one of this name must be checked".
    // (`input.value` is the static value attribute, so it is never empty.)
    if (field.type === 'radio') {
      var scope = field.form || doc;
      var group = scope.querySelectorAll('input[type="radio"][name="' + field.name + '"]');
      var anyChecked = Array.prototype.some.call(group, function (r) { return r.checked; });
      if (field.hasAttribute('required') && !anyChecked) {
        return field.getAttribute('data-msg-required') || 'Choose an option to continue.';
      }
      return '';
    }
    if (field.type === 'checkbox') {
      if (field.hasAttribute('required') && !field.checked) {
        return field.getAttribute('data-msg-required') || 'Please tick this box to continue.';
      }
      return '';
    }

    var value = (field.value || '').trim();
    if (field.hasAttribute('required') && !value) {
      return field.getAttribute('data-msg-required') || 'Enter your ' + label.toLowerCase() + '.';
    }
    if (!value) return '';

    if (field.type === 'email' && !EMAIL.test(value)) {
      return field.getAttribute('data-msg-email') || 'That doesn\u2019t look like a valid email address.';
    }
    if (field.type === 'tel' && value.replace(/\D/g, '').length < 10) {
      return field.getAttribute('data-msg-tel') || 'Enter a 10-digit phone number, including the area code.';
    }
    var min = parseInt(field.getAttribute('minlength') || '0', 10);
    if (min && value.length < min) {
      return 'Use at least ' + min + ' characters.';
    }
    var pattern = field.getAttribute('data-pattern');
    if (pattern && !new RegExp(pattern).test(value)) {
      return field.getAttribute('data-msg-pattern') || 'Please check this value.';
    }
    var match = field.getAttribute('data-match');
    if (match) {
      var other = doc.getElementById(match.replace('#', ''));
      if (other && other.value !== field.value) {
        return field.getAttribute('data-msg-match') || 'The two values don\u2019t match.';
      }
    }
    return '';
  }

  function validateForm(form) {
    var fields = Array.prototype.slice.call(
      form.querySelectorAll('input, select, textarea')
    ).filter(function (f) { return f.type !== 'hidden' && !f.disabled; });

    var firstBad = null;
    fields.forEach(function (field) {
      var message = validateField(field);
      if (message) {
        showError(field, message);
        if (!firstBad) firstBad = field;
      } else {
        clearError(field);
      }
    });
    return firstBad;
  }

  /** Swap a form for its success panel. */
  function succeed(form, data) {
    var panel = form.parentNode.querySelector('[data-success]') || doc.querySelector('[data-success]');
    if (!panel) return; // The page owns the next step (e.g. the login flow).
    if (panel) {
      var body = panel.querySelector('[data-success-body]');
      if (body && data) {
        Object.keys(data).forEach(function (key) {
          var slot = body.querySelector('[data-fill="' + key + '"]');
          if (slot) slot.textContent = data[key];
        });
      }
      panel.hidden = false;
      panel.setAttribute('tabindex', '-1');
      panel.focus();
    }
    form.hidden = true;
  }

  /* --- auto-wire every form marked data-validate -------------------------- */
  Array.prototype.slice.call(doc.querySelectorAll('form[data-validate]')).forEach(function (form) {
    var fields = Array.prototype.slice.call(form.querySelectorAll('input, select, textarea'));

    // Re-validate on blur once a field has been touched, and clear as you fix it.
    fields.forEach(function (field) {
      field.addEventListener('blur', function () {
        if (!field.value && !field.hasAttribute('required')) return;
        var message = validateField(field);
        if (message) showError(field, message); else clearError(field);
      });
      field.addEventListener('input', function () {
        if (field.classList.contains('is-bad')) {
          var message = validateField(field);
          if (message) showError(field, message); else clearError(field);
        }
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstBad = validateForm(form);
      if (firstBad) {
        firstBad.focus();
        firstBad.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      var data = {};
      fields.forEach(function (field) {
        if (field.name) data[field.name] = field.type === 'checkbox' ? field.checked : field.value;
      });
      form.dispatchEvent(new CustomEvent('meridian:submit', { detail: data, bubbles: true }));
      if (!form.hasAttribute('data-no-success')) succeed(form, data);
    });
  });

  /* --- live score for the security checklist ------------------------------ */
  var checklist = doc.querySelector('[data-checklist]');
  if (checklist) {
    var boxes = Array.prototype.slice.call(checklist.querySelectorAll('input[type="checkbox"]'));
    var bar = doc.querySelector('[data-score-bar]');
    var out = doc.querySelector('[data-score]');
    var msg = doc.querySelector('[data-score-msg]');

    var update = function () {
      var done = boxes.filter(function (b) { return b.checked; }).length;
      var pct = boxes.length ? Math.round((done / boxes.length) * 100) : 0;
      if (bar) bar.style.width = pct + '%';
      if (out) out.textContent = done + '/' + boxes.length;
      if (msg) {
        msg.textContent = pct === 100
          ? 'Excellent — you\u2019re doing everything on this list.'
          : pct >= 60
            ? 'Good start. Finish the remaining items and you\u2019ll close the gaps attackers look for.'
            : 'Worth some attention. Each item you tick removes a real, common attack path.';
      }
    };

    boxes.forEach(function (b) { b.addEventListener('change', update); });
    update();
  }

  window.MeridianForms = {
    validateField: validateField,
    validateForm: validateForm,
    showError: showError,
    clearError: clearError,
    succeed: succeed
  };
})();
