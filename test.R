res <- tryCatch({ 
  .t_res <- suppressWarnings({ x <- 10; x == 10 })
  .ok <- is.logical(.t_res) && length(.t_res) > 0 && all(!is.na(.t_res)) && all(.t_res)
  as.integer(isTRUE(.ok))
}, error = function(e) paste0("ERR:", conditionMessage(e)))
print(res)
