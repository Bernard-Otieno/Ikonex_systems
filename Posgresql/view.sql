CREATE OR REPLACE VIEW student_subject_summaries AS
SELECT 
    st.id AS student_id,
    st.admission_number,
    st.first_name,
    st.last_name,
    st.stream_id,
    sub.id AS subject_id,
    sub.name AS subject_name,
    coalesce(s.ca_score, 0) AS ca_score,
    coalesce(s.exam_score, 0) AS exam_score,
    (coalesce(s.ca_score, 0) + coalesce(s.exam_score, 0)) AS total_marks,
    -- Calculate grades based on the scale
    CASE 
        WHEN (coalesce(s.ca_score, 0) + coalesce(s.exam_score, 0)) >= 80 THEN 'A'
        WHEN (coalesce(s.ca_score, 0) + coalesce(s.exam_score, 0)) >= 70 THEN 'B'
        WHEN (coalesce(s.ca_score, 0) + coalesce(s.exam_score, 0)) >= 60 THEN 'C'
        WHEN (coalesce(s.ca_score, 0) + coalesce(s.exam_score, 0)) >= 50 THEN 'D'
        ELSE 'E'
    END AS grade,
    -- Calculate subject position within the stream
    RANK() OVER (
        PARTITION BY st.stream_id, sub.id 
        ORDER BY (coalesce(s.ca_score, 0) + coalesce(s.exam_score, 0)) DESC
    ) AS subject_position
FROM students st
CROSS JOIN subjects sub
LEFT JOIN scores s ON s.student_id = st.id AND s.subject_id = sub.id;