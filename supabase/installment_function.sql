-- Fonction pour créer automatiquement les tranches de paiement
CREATE OR REPLACE FUNCTION create_installments(
    p_registration_id UUID,
    p_user_id UUID,
    p_total_amount NUMERIC
) RETURNS VOID AS $$
DECLARE
    v_tranche_1 NUMERIC;
    v_tranche_2 NUMERIC;
BEGIN
    v_tranche_1 := FLOOR(p_total_amount * 0.5);
    v_tranche_2 := p_total_amount - v_tranche_1;

    -- Tranche 1 (Dépôt initial 50%)
    INSERT INTO payments (
        registration_id,
        user_id,
        amount,
        status,
        due_date,
        payment_type,
        tranche_number
    ) VALUES (
        p_registration_id,
        p_user_id,
        v_tranche_1,
        'pending',
        NOW(),
        'installment',
        1
    );

    -- Tranche 2 (Reste 50% après 30 jours par défaut)
    INSERT INTO payments (
        registration_id,
        user_id,
        amount,
        status,
        due_date,
        payment_type,
        tranche_number
    ) VALUES (
        p_registration_id,
        p_user_id,
        v_tranche_2,
        'pending',
        NOW() + INTERVAL '30 days',
        'installment',
        2
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
