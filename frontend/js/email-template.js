/**
 * Plantillas de Correo
 * Maneja la generación de contenido de correos electrónicos
 */
class EmailTemplate {
    /**
     * Sustituir variables en plantilla
     */
    substitute(template, variables) {
        let result = template;
        
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            result = result.replace(regex, value || '');
        }
        
        return result;
    }

    /**
     * Generar asunto del correo
     */
    generateSubject(alerta, obligacion, config = {}) {
        // Si hay un asunto personalizado en la configuración, usarlo
        if (config.email_subject && config.email_subject.trim()) {
            const diasRestantes = Utils.getDaysUntil(obligacion.fecha_limite);
            const fechaFormateada = Utils.formatDate(obligacion.fecha_limite, 'DD/MM/YYYY');
            
            const variables = {
                id_obligacion: obligacion.id,
                obligacion: obligacion.descripcion || obligacion.nombre,
                fecha_limite: fechaFormateada,
                dias_restantes: diasRestantes !== null ? diasRestantes.toString() : 'N/A',
                tipo_alerta: alerta.tipo
            };
            
            return this.substitute(config.email_subject, variables);
        }
        
        // Usar plantilla por defecto
        const tipo = alerta.tipo;
        const urgente = tipo === 'Crítica' ? '[URGENTE]' : '[ALERTA]';
        
        return `${urgente} Vencimiento ${obligacion.id} - ${obligacion.descripcion || obligacion.nombre}`;
    }

    /**
     * Generar cuerpo del correo
     */
    generateBody(alerta, obligacion, destinatario, config) {
        const diasRestantes = Utils.getDaysUntil(obligacion.fecha_limite);
        const fechaFormateada = Utils.formatDate(obligacion.fecha_limite, 'DD/MM/YYYY');
        
        const variables = {
            nombre: destinatario.nombre || destinatario,
            obligacion: obligacion.descripcion || obligacion.nombre,
            id_obligacion: obligacion.id,
            fecha_limite: fechaFormateada,
            dias_restantes: diasRestantes !== null ? diasRestantes.toString() : 'N/A',
            tipo_alerta: alerta.tipo,
            area: obligacion.area || 'N/A',
            regulador: obligacion.regulador || 'N/A',
            responsable: obligacion.responsable || 'N/A',
            nombre_remitente: config.nombre_remitente || 'AlertIA'
        };
        
        // Si hay un cuerpo personalizado en la configuración, usarlo
        if (config.email_body && config.email_body.trim()) {
            return this.substitute(config.email_body, variables);
        }
        
        // Usar plantilla por defecto según el tipo de alerta
        return this.substitute(this.getTemplate(alerta.tipo), variables);
    }

    /**
     * Obtener plantilla según tipo de alerta
     */
    getTemplate(tipoAlerta) {
        const templates = {
            '1ra Alerta': `
Estimado {nombre},

Le informamos que la obligación normativa **{obligacion}** tiene fecha límite el **{fecha_limite}** (faltan {dias_restantes} días).

Esta es una **{tipo_alerta}** y requiere su atención.

**Detalles de la Obligación:**
- ID Obligación: {id_obligacion}
- Área Responsable: {area}
- Regulador: {regulador}
- Responsable: {responsable}

Por favor, tome las acciones necesarias para cumplir con esta obligación antes de la fecha límite indicada.

Saludos cordiales,
**Equipo de {nombre_remitente}**

---
Este es un correo automático, por favor no responda a esta dirección.
AlertIA Systems.
            `,
            
            '2da Alerta': `
Estimado {nombre},

Le recordamos que la obligación normativa **{obligacion}** tiene fecha límite el **{fecha_limite}** (faltan {dias_restantes} días).

Esta es una **{tipo_alerta}** y requiere atención prioritaria.

**Detalles de la Obligación:**
- ID Obligación: {id_obligacion}
- Área Responsable: {area}
- Regulador: {regulador}
- Responsable: {responsable}

Es importante que tome las acciones necesarias para cumplir con esta obligación antes de la fecha límite.

Saludos cordiales,
**Equipo de {nombre_remitente}**

---
Este es un correo automático, por favor no responda a esta dirección.
AlertIA Systems.
            `,
            
            'Crítica': `
Estimado {nombre},

**URGENTE:** La obligación normativa **{obligacion}** tiene fecha límite el **{fecha_limite}** (faltan {dias_restantes} días).

Esta es una **{tipo_alerta}** y requiere atención INMEDIATA.

**Detalles de la Obligación:**
- ID Obligación: {id_obligacion}
- Área Responsable: {area}
- Regulador: {regulador}
- Responsable: {responsable}

**ACCIÓN REQUERIDA:** Por favor, tome las acciones necesarias INMEDIATAMENTE para cumplir con esta obligación antes de la fecha límite.

Saludos cordiales,
**Equipo de {nombre_remitente}**

---
Este es un correo automático, por favor no responda a esta dirección.
AlertIA Systems.
            `
        };
        
        return templates[tipoAlerta] || templates['1ra Alerta'];
    }

    /**
     * Generar correo completo
     */
    generateEmail(alerta, obligacion, destinatario, config) {
        const asunto = this.generateSubject(alerta, obligacion, config);
        const cuerpo = this.generateBody(alerta, obligacion, destinatario, config);
        
        return {
            asunto: asunto,
            cuerpo: cuerpo,
            remitente: config.remitente,
            nombre_remitente: config.nombre_remitente,
            destinatario: destinatario.email || destinatario,
            cc: config.cc_global || [],
            tipo: alerta.tipo,
            obligacion_id: obligacion.id
        };
    }

    /**
     * Generar vista previa HTML del correo
     */
    generatePreviewHTML(email) {
        const cuerpoHTML = email.cuerpo
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="margin-bottom: 20px;">
                    <h2 style="color: #ec0000;">AlertIA</h2>
                </div>
                <div style="line-height: 1.6; color: #333;">
                    ${cuerpoHTML}
                </div>
            </div>
        `;
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.EmailTemplate = EmailTemplate;
}
